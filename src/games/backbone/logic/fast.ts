import type { LevelIndex } from './graph';
import { linksOfPath, shortestPath } from './graph';
import { profiles } from './profiles';
import { obeysPolicy, REPAIR_DELAY } from './simulate';
import type { FlowPlan } from './types';

/**
 * The stress test again, for the solver: the same rules as `simulate.ts` on arrays instead of
 * records, and it only returns what each flow earned in each situation. The solver runs it many
 * thousands of times; the readable version stays the one the interface uses. A test compares the
 * two on many random plans, so they cannot drift apart.
 */

interface CompiledPath {
  links: Int32Array;
  share: number;
  /** The path is not a path of the network or skips a node the flow has to pass: it carries nothing */
  blocked: boolean;
}

export interface CompiledOption {
  flow: number;
  stages: readonly { from: number; paths: readonly CompiledPath[] }[];
  backup: Int32Array | undefined;
  redundancy: number;
  throttle: number;
}

interface SituationTables {
  steps: number;
  /** [step * linkCount + link] */
  capacity: Float64Array;
  loss: Float64Array;
  up: Uint8Array;
  /** [step * flowCount + flow] */
  demand: Float64Array;
}

const NONE = new Int32Array(0);

export class FastEvaluator {
  readonly flowCount: number;
  readonly linkCount: number;
  readonly situationCount: number;
  /** What each situation could earn at the most */
  readonly possible: number[];

  private readonly linkNumber = new Map<string, number>();
  private readonly flowNumber = new Map<string, number>();
  private readonly delay: Float64Array;
  private readonly tables: SituationTables[] = [];
  private readonly repairs = new Map<string, Int32Array | null>();
  private readonly weight: Float64Array;
  private readonly queue: Int32Array;
  private readonly offered: Float64Array;
  private readonly total: Float64Array;

  constructor(private readonly index: LevelIndex) {
    const { level } = index;
    this.flowCount = level.flows.length;
    this.linkCount = level.links.length;
    this.situationCount = level.situations.length;
    level.links.forEach((link, position) => this.linkNumber.set(link.id, position));
    level.flows.forEach((flow, position) => this.flowNumber.set(flow.id, position));
    this.delay = Float64Array.from(level.links.map((link) => link.delay));
    this.weight = Float64Array.from(level.flows.map((flow) => profiles[flow.profile].weight));
    this.queue = Int32Array.from(level.flows.map((flow) => profiles[flow.profile].queue));
    this.offered = new Float64Array(this.linkCount * 3);
    this.total = new Float64Array(this.linkCount);

    for (const situation of level.situations) {
      const table: SituationTables = {
        steps: situation.steps,
        capacity: new Float64Array(situation.steps * this.linkCount),
        loss: new Float64Array(situation.steps * this.linkCount),
        up: new Uint8Array(situation.steps * this.linkCount),
        demand: new Float64Array(situation.steps * this.flowCount),
      };
      for (let step = 0; step < situation.steps; step += 1) {
        level.links.forEach((link, position) => {
          let capacity = link.capacity;
          let keep = 1 - link.loss;
          let down = false;
          for (const event of situation.events) {
            if (
              event.kind === 'burst' ||
              step < event.from ||
              step >= event.to ||
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
          const at = step * this.linkCount + position;
          table.capacity[at] = down ? 0 : capacity;
          table.loss[at] = 1 - keep;
          table.up[at] = down ? 0 : 1;
        });
        level.flows.forEach((flow, position) => {
          let demand = flow.demand;
          for (const event of situation.events) {
            if (
              event.kind === 'burst' &&
              event.flow === flow.id &&
              step >= event.from &&
              step < event.to
            ) {
              demand *= event.factor;
            }
          }
          table.demand[step * this.flowCount + position] = demand;
        });
      }
      this.tables.push(table);
    }

    this.possible = this.tables.map((table) => {
      let sum = 0;
      for (let step = 0; step < table.steps; step += 1) {
        for (let flow = 0; flow < this.flowCount; flow += 1) {
          sum += (this.weight[flow] ?? 0) * (table.demand[step * this.flowCount + flow] ?? 0);
        }
      }
      return sum;
    });
  }

  flowIndexOf(id: string): number {
    return this.flowNumber.get(id) ?? -1;
  }

  private numbers(path: readonly string[]): Int32Array {
    const links = linksOfPath(this.index, path) ?? [];
    return Int32Array.from(links.map((id) => this.linkNumber.get(id) ?? -1));
  }

  compile(flowId: string, plan: FlowPlan): CompiledOption {
    const flow = this.index.level.flows.find((entry) => entry.id === flowId);
    const allowed = (path: readonly string[]): boolean =>
      flow !== undefined && obeysPolicy(flow, path) && linksOfPath(this.index, path) !== undefined;
    return {
      flow: this.flowNumber.get(flowId) ?? -1,
      stages: plan.stages.map((stage) => ({
        from: stage.from,
        paths: stage.paths.map((entry) => ({
          links: this.numbers(entry.nodes),
          share: entry.share,
          blocked: !allowed(entry.nodes),
        })),
      })),
      backup:
        plan.backup === undefined || !allowed(plan.backup) ? undefined : this.numbers(plan.backup),
      redundancy: plan.redundancy,
      throttle: plan.throttle,
    };
  }

  private allUp(table: SituationTables, step: number, links: Int32Array): boolean {
    for (const link of links) {
      if (table.up[step * this.linkCount + link] !== 1) {
        return false;
      }
    }
    return true;
  }

  private repaired(
    situation: number,
    table: SituationTables,
    step: number,
    flow: number,
  ): Int32Array | undefined {
    const key = `${String(situation)}:${String(step)}:${String(flow)}`;
    let cached = this.repairs.get(key);
    if (cached === undefined) {
      const spec = this.index.level.flows[flow];
      const path =
        spec === undefined
          ? undefined
          : shortestPath(
              this.index,
              spec.source,
              spec.target,
              (id) => table.up[step * this.linkCount + (this.linkNumber.get(id) ?? 0)] === 1,
            );
      cached = path === undefined ? null : this.numbers(path);
      this.repairs.set(key, cached);
    }
    return cached ?? undefined;
  }

  /**
   * What the placed flows earned in every situation: `result[situation * flowCount + flow]`.
   * `options` has one entry per flow of the level, `undefined` for a flow that is not in the plan.
   * With `loads` the traffic offered to every link in every step is written there (situations one
   * after the other, steps one after the other, links in the order of the level).
   */
  earned(options: readonly (CompiledOption | undefined)[], loads?: number[]): Float64Array {
    const result = new Float64Array(this.situationCount * this.flowCount);
    const { offered, total, linkCount, flowCount } = this;
    this.tables.forEach((table, situation) => {
      for (let step = 0; step < table.steps; step += 1) {
        offered.fill(0);
        const resolved: { links: Int32Array; share: number; amount: number }[][] = [];
        for (let flow = 0; flow < flowCount; flow += 1) {
          const option = options[flow];
          const paths: { links: Int32Array; share: number; amount: number }[] = [];
          resolved.push(paths);
          if (option === undefined) {
            continue;
          }
          let stage = option.stages[0];
          for (const candidate of option.stages) {
            if (candidate.from <= step) {
              stage = candidate;
            }
          }
          const demand = table.demand[step * flowCount + flow] ?? 0;
          for (const entry of stage?.paths ?? []) {
            let links: Int32Array | undefined = entry.blocked ? undefined : entry.links;
            if (links !== undefined && !this.allUp(table, step, links)) {
              if (option.backup !== undefined && this.allUp(table, step, option.backup)) {
                links = option.backup;
              } else {
                let brokenFor = 0;
                for (
                  let before = step;
                  before >= 0 && !this.allUp(table, before, entry.links);
                  before -= 1
                ) {
                  brokenFor += 1;
                }
                // A flow with a policy is not rerouted by itself
                links =
                  brokenFor <= REPAIR_DELAY || (this.index.level.flows[flow]?.via ?? []).length > 0
                    ? undefined
                    : this.repaired(situation, table, step, flow);
              }
            }
            const amount =
              links === undefined
                ? 0
                : demand * option.throttle * entry.share * (1 + option.redundancy);
            paths.push({ links: links ?? NONE, share: entry.share, amount });
            const queue = this.queue[flow] ?? 0;
            for (const link of links ?? NONE) {
              offered[link * 3 + queue] = (offered[link * 3 + queue] ?? 0) + amount;
            }
          }
        }
        // Serve the queues of every link in order of priority.
        const satisfied = new Float64Array(linkCount * 3);
        for (let link = 0; link < linkCount; link += 1) {
          let remaining = table.capacity[step * linkCount + link] ?? 0;
          let sum = 0;
          for (let queue = 0; queue < 3; queue += 1) {
            const want = offered[link * 3 + queue] ?? 0;
            sum += want;
            if (want <= 0) {
              satisfied[link * 3 + queue] = 1;
            } else {
              const give = Math.min(want, remaining);
              remaining -= give;
              satisfied[link * 3 + queue] = give / want;
            }
          }
          total[link] = sum;
          loads?.push(sum);
        }
        for (let flow = 0; flow < flowCount; flow += 1) {
          const option = options[flow];
          const spec = this.index.level.flows[flow];
          if (spec === undefined) {
            continue;
          }
          const profile = profiles[spec.profile];
          const demand = table.demand[step * flowCount + flow] ?? 0;
          const maxValue = (this.weight[flow] ?? 0) * demand;
          let arrived = 0;
          let timelyArrived = 0;
          for (const path of resolved[flow] ?? []) {
            if (path.amount <= 0) {
              continue;
            }
            let kept = 1;
            let passes = 1;
            let latency = 0;
            for (const link of path.links) {
              kept = Math.min(kept, satisfied[link * 3 + (this.queue[flow] ?? 0)] ?? 0);
              passes *= 1 - (table.loss[step * linkCount + link] ?? 0);
              const capacity = table.capacity[step * linkCount + link] ?? 0;
              const load = capacity > 0 ? Math.min(1, (total[link] ?? 0) / capacity) : 1;
              latency += (this.delay[link] ?? 0) * (1 + load * load);
            }
            const residual = Math.max(0, 1 - passes - (option?.redundancy ?? 0));
            const delivered = path.share * kept * (1 - residual);
            const budget = profile.latencyBudget;
            const timely =
              budget === undefined
                ? 1
                : Math.max(0, 1 - (profile.steepness * Math.max(0, latency - budget)) / budget);
            arrived += delivered;
            timelyArrived += delivered * timely;
          }
          const share = arrived * (option?.throttle ?? 0);
          const timeliness = arrived > 0 ? timelyArrived / arrived : 1;
          const slot = situation * flowCount + flow;
          result[slot] =
            (result[slot] ?? 0) + maxValue * share ** profile.lossExponent * timeliness;
        }
      }
    });
    return result;
  }
}
