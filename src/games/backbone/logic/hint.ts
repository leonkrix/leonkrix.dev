import { nameOf, type PlayState, readyToRun, unrouted } from './play';
import { evaluate } from './simulate';
import { describeOverload, linkName, summarize } from './text';
import type { FlowPlan, Plan } from './types';

/**
 * Hints, in three steps that get more concrete. The best plan of the level is the guide.
 *
 * 1. What is wrong with the plan now (an overfull cable, the flow that loses the most).
 * 2. Where to look: the flows that use that cable, or the flow that loses.
 * 3. What to try: the first thing in which the plan differs from the best plan. This step gives
 *    the answer away, so a run after it earns no stars.
 */

export interface Hint {
  stage: 1 | 2 | 3;
  text: string;
  /** Cables to point at on the map */
  links: readonly string[];
  /** Flows to point at */
  flows: readonly string[];
  /** The hint tells what to do: a run after it earns no stars */
  givesAway: boolean;
}

export interface Guide {
  plan: Plan;
  built: readonly string[];
  score: number;
}

/** The longest text of a hint that fits the status line (three lines, four on a narrow map). */
const MOST = 120;

/** How close to the best plan counts as "as good as it gets". */
const CLOSE = 0.01;

function sameFlowPlan(a: FlowPlan | undefined, b: FlowPlan | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Names for a sentence: at most three, then "and 2 more". */
function listOf(names: readonly string[]): string {
  if (names.length <= 3) {
    return names.join(' and ');
  }
  return `${names.slice(0, 2).join(', ')} and ${String(names.length - 2)} more`;
}

/** The hint for a path or a split, as short as it can be said: long paths are left out. */
function splitText(
  state: PlayState,
  flow: string,
  paths: readonly { nodes: readonly string[]; share: number }[],
  first: readonly string[],
): string {
  if (paths.length <= 1) {
    return `Try sending ${flow} ${via(state, first)}.`;
  }
  const shares = paths.map((path) => String(Math.round(path.share * 100)));
  const full = `Split ${flow} over ${String(paths.length)} paths: ${paths
    .map((path, at) => `${shares[at] ?? ''} % ${via(state, path.nodes)}`)
    .join(', ')}.`;
  if (full.length <= MOST) {
    return full;
  }
  const main = `Split ${flow} over ${String(paths.length)} paths, ${shares.join(' / ')} %. The first ${via(state, paths[0]?.nodes ?? [])}.`;
  return main.length <= MOST
    ? main
    : `Split ${flow} over ${String(paths.length)} paths, ${shares.join(' / ')} %.`;
}

/** A path in a few words: the nodes between the two ends, which are named by the flow anyway. */
function via(state: PlayState, nodes: readonly string[]): string {
  const between = nodes.slice(1, -1).map((node) => nameOf(state, node));
  return between.length === 0 ? 'the direct cable' : `via ${between.join(' and ')}`;
}

/** What the first flow that differs from the best plan should do, in words. */
function difference(state: PlayState, guide: Guide): { text: string; flow: string } | undefined {
  const flows = [...state.index.level.flows].sort((a, b) => b.demand - a.demand);
  for (const flow of flows) {
    const mine = state.plan[flow.id];
    const best = guide.plan[flow.id];
    if (best === undefined || sameFlowPlan(mine, best)) {
      continue;
    }
    const paths = best.stages[0]?.paths ?? [];
    const first = best.stages[0];
    if (best.stages.length > 1 && mine?.stages.length !== best.stages.length) {
      const from = best.stages[1]?.from ?? 0;
      return {
        flow: flow.id,
        text: `${flow.name} should change its path in minute ${String(from + 1)}.`,
      };
    }
    if (JSON.stringify(mine?.stages) !== JSON.stringify(best.stages)) {
      return {
        flow: flow.id,
        text: splitText(state, flow.name, paths, first?.paths[0]?.nodes ?? []),
      };
    }
    if (best.backup !== undefined && mine?.backup === undefined) {
      return { flow: flow.id, text: `Give ${flow.name} a backup path.` };
    }
    if (best.redundancy !== (mine?.redundancy ?? 0)) {
      return {
        flow: flow.id,
        text: `Set the extra packets of ${flow.name} to ${String(best.redundancy * 100)} %.`,
      };
    }
    if (best.throttle !== (mine?.throttle ?? 1)) {
      return {
        flow: flow.id,
        text: `Let ${flow.name} send only ${String(best.throttle * 100)} % of its traffic.`,
      };
    }
  }
  return undefined;
}

/** The hint of a stage for the plan as it is now. */
export function hintFor(state: PlayState, guide: Guide, stage: 1 | 2 | 3): Hint {
  const none = { links: [], flows: [], givesAway: false } as const;
  const missing = unrouted(state);
  if (!readyToRun(state)) {
    return {
      ...none,
      stage,
      text:
        missing.length > 0
          ? `Give every flow a path first: ${missing.map((flow) => flow.name).join(', ')} still ${missing.length === 1 ? 'needs' : 'need'} one.`
          : 'Something in the plan cannot run yet.',
      flows: missing.map((flow) => flow.id),
    };
  }
  const built = [...state.built].sort().join();
  const target = [...guide.built].sort().join();
  const evaluation = evaluate(state.index, state.plan);
  if (evaluation.score >= guide.score - CLOSE && built === target) {
    return { ...none, stage, text: 'This plan is about as good as it gets. Run it.' };
  }
  const summary = summarize(state.index, evaluation);
  const busiest =
    summary.busiest !== undefined && summary.busiest.ratio > 1 + 1e-9 ? summary.busiest : undefined;
  const names = new Map(state.index.level.flows.map((flow) => [flow.id, flow.name]));
  if (stage === 1) {
    const worst = summary.worstFlow;
    return {
      ...none,
      stage,
      text:
        busiest !== undefined
          ? describeOverload(state.index, busiest)
          : worst !== undefined
            ? `${names.get(worst.flow) ?? worst.flow} loses ${String(Math.round(worst.lost * 100))} % of its value. Look at what it needs.`
            : 'Nothing is overfull, but the best plan does more with the same network.',
      links: busiest === undefined ? [] : [busiest.link],
      flows: worst === undefined ? [] : [worst.flow],
    };
  }
  if (stage === 2) {
    if (busiest !== undefined) {
      const users = state.index.level.flows.filter((flow) =>
        (state.plan[flow.id]?.stages ?? []).some((entry) =>
          entry.paths.some((path) => pathUses(state, path.nodes, busiest.link)),
        ),
      );
      return {
        ...none,
        stage,
        text: `${linkName(state.index, busiest.link)} is used by ${users.length > 0 ? listOf(users.map((flow) => flow.name)) : 'a flood'}. Could one of them go another way?`,
        links: [busiest.link],
        flows: users.map((flow) => flow.id),
      };
    }
    const worst = summary.worstFlow;
    return {
      ...none,
      stage,
      text:
        worst === undefined
          ? 'Look at the situations after the quiet day: a burst, a cut cable or a flood.'
          : `Look at ${names.get(worst.flow) ?? worst.flow}: what could help it in the bad moment?`,
      flows: worst === undefined ? [] : [worst.flow],
    };
  }
  // Stage 3: the first difference from the best plan. A cable that is not built comes first.
  const toBuild = guide.built.find((id) => !state.built.includes(id));
  if (toBuild !== undefined) {
    return {
      ...none,
      stage,
      text: `Build ${linkName({ ...state.index, level: state.base }, toBuild)}.`,
      links: [toBuild],
      givesAway: true,
    };
  }
  const extra = state.built.find((id) => !guide.built.includes(id));
  if (extra !== undefined) {
    return {
      ...none,
      stage,
      text: `The money for ${linkName({ ...state.index, level: state.base }, extra)} is better spent elsewhere.`,
      links: [extra],
      givesAway: true,
    };
  }
  const next = difference(state, guide);
  return {
    ...none,
    stage,
    text: next?.text ?? 'Try a different way for the flow that loses the most.',
    flows: next === undefined ? [] : [next.flow],
    givesAway: true,
  };
}

function pathUses(state: PlayState, nodes: readonly string[], link: string): boolean {
  const found = state.index.linkById.get(link);
  if (found === undefined) {
    return false;
  }
  return nodes.some(
    (node, at) =>
      (node === found.a && nodes[at + 1] === found.b) ||
      (node === found.b && nodes[at + 1] === found.a),
  );
}
