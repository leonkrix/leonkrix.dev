import { floodLoads } from './flood';
import { indexLevel, type LevelIndex, linksOfPath, shortestPath } from './graph';
import { profiles } from './profiles';
import { bufferSize, QUEUE_DELAY } from './queues';
import type {
  Evaluation,
  Flow,
  FlowPlan,
  FlowStepResult,
  Level,
  LinkStepResult,
  NetEvent,
  Plan,
  RouteStage,
  Situation,
  SituationResult,
  StepResult,
} from './types';

/**
 * The stress test: a deterministic fluid model. No dice, the same plan always gives the same result.
 *
 * In every step each flow sends its demand (changed by bursts, held back by the throttle, and
 * increased by redundancy) along the paths of its plan. On every link the queues are served in
 * order (voice and control, then web and the like, then bulk) until the capacity is used up, the
 * rest is dropped. A flow is as fast as its narrowest link: the share of it that arrives is the
 * smallest share any link on its path grants it. A flow earns `weight x demand x delivered^k x timeliness` per step, where k is
 * how much the profile hates loss, and timeliness falls when the path takes longer than the budget.
 *
 * Property the solver relies on (tested): adding traffic to a plan never improves what a flow that
 * is already in the plan earns. That is why a link only splits its capacity by queue and the
 * demand a flow offers to a link is not reduced by drops on other links.
 */

/** A flow whose path is cut is repaired by the network after this many steps. */
export const REPAIR_DELAY = 2;

interface LinkState {
  capacity: number;
  down: boolean;
  loss: number;
}

interface ResolvedPath {
  share: number;
  links: readonly string[];
  /** Traffic offered to every link of the path in this step */
  amount: number;
  queue: number;
}

function covers(event: { from: number; to: number }, step: number): boolean {
  return step >= event.from && step < event.to;
}

/** The state of every link in every step of a situation. */
function linkStates(index: LevelIndex, situation: Situation): Map<string, LinkState>[] {
  const states: Map<string, LinkState>[] = [];
  for (let step = 0; step < situation.steps; step += 1) {
    const state = new Map<string, LinkState>();
    for (const link of index.level.links) {
      let capacity = link.capacity;
      let keep = 1 - link.loss;
      let down = false;
      for (const event of situation.events) {
        if (
          event.kind === 'burst' ||
          event.kind === 'flood' ||
          !covers(event, step) ||
          event.link !== link.id
        ) {
          continue;
        }
        if (event.kind === 'down') {
          down = true;
        } else if (event.kind === 'lossy') {
          keep *= 1 - event.loss;
        } else {
          capacity = Math.floor(capacity * event.factor);
        }
      }
      state.set(link.id, { capacity: down ? 0 : capacity, down, loss: 1 - keep });
    }
    states.push(state);
  }
  return states;
}

function demandAt(events: readonly NetEvent[], flow: string, base: number, step: number): number {
  let demand = base;
  for (const event of events) {
    if (event.kind === 'burst' && event.flow === flow && covers(event, step)) {
      demand *= event.factor;
    }
  }
  return demand;
}

function stageAt(stages: readonly RouteStage[], step: number): RouteStage | undefined {
  let current: RouteStage | undefined;
  for (const stage of stages) {
    if (stage.from <= step) {
      current = stage;
    }
  }
  return current;
}

function isUp(states: readonly Map<string, LinkState>[], step: number, link: string): boolean {
  return states[step]?.get(link)?.down === false;
}

/**
 * The links a planned path really uses in `step`: itself while it is whole, the backup when the
 * path is cut and the backup is whole, a freshly found fastest path once the break is older than
 * the repair delay, otherwise nothing (the traffic is lost).
 */
/** Whether a path passes every node the flow has to pass. */
export function obeysPolicy(flow: Flow, path: readonly string[]): boolean {
  return (flow.via ?? []).every((node) => path.includes(node));
}

function resolve(
  index: LevelIndex,
  states: readonly Map<string, LinkState>[],
  flowPlan: FlowPlan,
  links: readonly string[],
  flow: Flow,
  step: number,
): readonly string[] | undefined {
  if (links.every((link) => isUp(states, step, link))) {
    return links;
  }
  if (flowPlan.backup !== undefined) {
    const backup = obeysPolicy(flow, flowPlan.backup)
      ? linksOfPath(index, flowPlan.backup)
      : undefined;
    if (backup?.every((link) => isUp(states, step, link)) === true) {
      return backup;
    }
  }
  let brokenFor = 0;
  for (let before = step; before >= 0; before -= 1) {
    if (links.every((link) => isUp(states, before, link))) {
      break;
    }
    brokenFor += 1;
  }
  if (brokenFor <= REPAIR_DELAY) {
    return undefined;
  }
  // A flow with a policy is not rerouted by itself: it would not know where it may go
  if ((flow.via ?? []).length > 0) {
    return undefined;
  }
  const repaired = shortestPath(index, flow.source, flow.target, (link) =>
    isUp(states, step, link),
  );
  return repaired === undefined ? undefined : linksOfPath(index, repaired);
}

function simulateSituation(index: LevelIndex, plan: Plan, situation: Situation): SituationResult {
  const states = linkStates(index, situation);
  const steps: StepResult[] = [];
  // What waits in the buffers of every link (per queue class), carried from step to step
  const backlog = new Map<string, number[]>(index.level.links.map((link) => [link.id, [0, 0, 0]]));
  let earned = 0;
  let possible = 0;

  for (let step = 0; step < situation.steps; step += 1) {
    const state = states[step];
    if (state === undefined) {
      continue;
    }
    const resolved = new Map<string, ResolvedPath[]>();
    const attack = floodLoads(index, situation.events, step, (link) => isUp(states, step, link));
    const demands = new Map<string, number>();
    const offered = new Map<string, number[]>();
    for (const link of index.level.links) {
      // A flood fills the middle queue class
      offered.set(link.id, [0, attack.get(link.id) ?? 0, 0]);
    }

    for (const flow of index.level.flows) {
      const demand = demandAt(situation.events, flow.id, flow.demand, step);
      demands.set(flow.id, demand);
      const flowPlan = plan[flow.id];
      const stage = flowPlan === undefined ? undefined : stageAt(flowPlan.stages, step);
      if (flowPlan === undefined || stage === undefined) {
        continue;
      }
      const queue = profiles[flow.profile].queue;
      const paths: ResolvedPath[] = [];
      for (const weighted of stage.paths) {
        const planned = linksOfPath(index, weighted.nodes);
        const links =
          planned === undefined || !obeysPolicy(flow, weighted.nodes)
            ? undefined
            : resolve(index, states, flowPlan, planned, flow, step);
        const amount = demand * flowPlan.throttle * weighted.share * (1 + flowPlan.redundancy);
        paths.push({
          share: weighted.share,
          links: links ?? [],
          amount: links === undefined ? 0 : amount,
          queue,
        });
        for (const link of links ?? []) {
          const queues = offered.get(link);
          if (queues !== undefined) {
            queues[queue] = (queues[queue] ?? 0) + amount;
          }
        }
      }
      resolved.set(flow.id, paths);
    }

    // Serve the queues of every link in order of priority. What does not go through waits in the
    // buffer of its class, what does not fit into the buffer is dropped.
    const satisfied = new Map<string, number[]>();
    const waiting = new Map<string, number[]>();
    const linkResults: Record<string, LinkStepResult> = {};
    for (const link of index.level.links) {
      const queues = offered.get(link.id) ?? [0, 0, 0];
      const held = backlog.get(link.id) ?? [0, 0, 0];
      const capacity = state.get(link.id)?.capacity ?? 0;
      const buffer = bufferSize(index.level, link);
      let remaining = capacity;
      const shares: number[] = [];
      const behind: number[] = [];
      let queued = 0;
      queues.forEach((want, queue) => {
        const content = (held[queue] ?? 0) + want;
        const served = Math.min(content, remaining);
        remaining -= served;
        const left = content - served;
        const keep = Math.min(left, buffer);
        held[queue] = keep;
        queued += keep;
        behind.push(queued);
        shares.push(want > 0 ? Math.max(0, 1 - (left - keep) / want) : 1);
      });
      satisfied.set(link.id, shares);
      waiting.set(
        link.id,
        behind.map((value) => (value / Math.max(capacity, 1)) * QUEUE_DELAY),
      );
      linkResults[link.id] = {
        offered: queues.reduce((sum, value) => sum + value, 0),
        attack: attack.get(link.id) ?? 0,
        queued,
        buffer,
        capacity,
        down: state.get(link.id)?.down ?? false,
      };
    }

    const flowResults: Record<string, FlowStepResult> = {};
    for (const flow of index.level.flows) {
      const profile = profiles[flow.profile];
      const demand = demands.get(flow.id) ?? 0;
      const flowPlan = plan[flow.id];
      const paths = resolved.get(flow.id) ?? [];
      let arrived = 0;
      let timelyArrived = 0;
      let latencySum = 0;
      for (const path of paths) {
        if (path.amount <= 0) {
          continue;
        }
        let kept = 1;
        let passes = 1;
        let latency = 0;
        for (const id of path.links) {
          const link = index.linkById.get(id);
          const linkState = state.get(id);
          if (link === undefined || linkState === undefined) {
            continue;
          }
          kept = Math.min(kept, satisfied.get(id)?.[path.queue] ?? 0);
          passes *= 1 - linkState.loss;
          const total = linkResults[id]?.offered ?? 0;
          const load = linkState.capacity > 0 ? Math.min(1, total / linkState.capacity) : 1;
          latency += link.delay * (1 + load * load) + (waiting.get(id)?.[path.queue] ?? 0);
        }
        const residual = Math.max(0, 1 - passes - (flowPlan?.redundancy ?? 0));
        const delivered = path.share * kept * (1 - residual);
        const budget = profile.latencyBudget;
        const timely =
          budget === undefined
            ? 1
            : Math.max(0, 1 - (profile.steepness * Math.max(0, latency - budget)) / budget);
        arrived += delivered;
        timelyArrived += delivered * timely;
        latencySum += delivered * latency;
      }
      const share = arrived * (flowPlan?.throttle ?? 0);
      const timeliness = arrived > 0 ? timelyArrived / arrived : 1;
      const maxValue = profile.weight * demand;
      const value = maxValue * share ** profile.lossExponent * timeliness;
      earned += value;
      possible += maxValue;
      flowResults[flow.id] = {
        sent: demand * (flowPlan?.throttle ?? 0),
        delivered: share,
        latency: arrived > 0 ? latencySum / arrived : 0,
        paths: paths
          .filter((path) => path.amount > 0)
          .map((path) => ({ links: path.links, share: path.share })),
        value,
        maxValue,
      };
    }
    steps.push({ flows: flowResults, links: linkResults });
  }

  return { situation: situation.id, score: possible > 0 ? earned / possible : 1, steps };
}

/** Runs a plan through every situation of a level. */
export function evaluate(level: Level | LevelIndex, plan: Plan): Evaluation {
  const index = 'linkById' in level ? level : indexLevel(level);
  const situations = index.level.situations.map((situation) =>
    simulateSituation(index, plan, situation),
  );
  const scores = situations.map((result) => result.score);
  const worst = Math.min(...scores);
  const score =
    scores.length === 0
      ? 1
      : (scores.reduce((sum, value) => sum + value, 0) + worst) / (scores.length + 1);
  return { score, situations };
}
