import { loadBalancedPlan, shortestPathPlan } from './baselines';
import { type CompiledOption, FastEvaluator } from './fast';
import { indexLevel, type LevelIndex } from './graph';
import { defaultLimits, flowOptions, type OptionLimits } from './options';
import { profiles } from './profiles';
import { evaluate } from './simulate';
import type { Evaluation, FlowPlan, Level, Plan } from './types';

/**
 * The exact solver: the best plan made of the options of `options.ts`, proven by branch and bound.
 *
 * The flows are placed one after the other, the most valuable first. After each placement the
 * stress test runs with the flows placed so far. Because extra traffic never helps a flow that is
 * already in the plan (tested in `simulate.test.ts`), what the placed flows earn in that partial
 * plan can only go down as more flows are added. Together with the best every remaining flow could
 * earn alone, that is an upper bound; a branch whose bound cannot beat the best plan found so far
 * is cut off without losing the optimum.
 */

export interface SolveOptions {
  limits?: OptionLimits;
  /** Stop after this many milliseconds and report `complete: false` (the best plan found so far is still valid) */
  timeLimitMs?: number;
}

export interface Solution {
  plan: Plan;
  score: number;
  /** Partial plans the stress test was run on */
  explored: number;
  /** False when the time ran out, then `plan` is the best found but not proven */
  complete: boolean;
  milliseconds: number;
}

/** What each situation could earn at the most. */
export function possibleValues(index: LevelIndex): number[] {
  return evaluate(index, {}).situations.map((situation) =>
    situation.steps.reduce(
      (sum, step) =>
        sum + Object.values(step.flows).reduce((inner, flow) => inner + flow.maxValue, 0),
      0,
    ),
  );
}

/** What every flow earned in every situation: `result[flowId][situation]`. */
export function earnedByFlow(index: LevelIndex, evaluation: Evaluation): Map<string, number[]> {
  const earned = new Map<string, number[]>();
  for (const flow of index.level.flows) {
    earned.set(
      flow.id,
      evaluation.situations.map((situation) =>
        situation.steps.reduce((sum, step) => sum + (step.flows[flow.id]?.value ?? 0), 0),
      ),
    );
  }
  return earned;
}

/** The score of a plan from what it earned per situation: the mean with the worst counted twice. */
export function objective(earned: readonly number[], possible: readonly number[]): number {
  const scores = earned.map((value, position) => {
    const most = possible[position] ?? 0;
    return most > 0 ? value / most : 1;
  });
  if (scores.length === 0) {
    return 1;
  }
  return (
    (scores.reduce((sum, value) => sum + value, 0) + Math.min(...scores)) / (scores.length + 1)
  );
}

interface Candidate {
  option: FlowPlan;
  compiled: CompiledOption;
  /** What the flow earns alone in each situation */
  alone: number[];
  rank: number;
}

/** The options of a flow with what each earns alone; options that behave exactly alike are kept once. */
function candidatesOf(
  index: LevelIndex,
  fast: FastEvaluator,
  flowId: string,
  limits: OptionLimits,
): Candidate[] {
  const flow = index.level.flows.find((entry) => entry.id === flowId);
  if (flow === undefined) {
    return [];
  }
  const position = fast.flowIndexOf(flowId);
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const option of flowOptions(index, flow, limits)) {
    const compiled = fast.compile(flowId, option);
    const only: (CompiledOption | undefined)[] = Array.from(
      { length: fast.flowCount },
      () => undefined,
    );
    only[position] = compiled;
    const loads: number[] = [];
    const earned = fast.earned(only, loads);
    const alone = fast.possible.map(
      (_, situation) => earned[situation * fast.flowCount + position] ?? 0,
    );
    const key = JSON.stringify([
      alone.map((value) => value.toFixed(9)),
      loads.map((value) => value.toFixed(9)),
    ]);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push({
      option,
      compiled,
      alone,
      rank: alone.reduce(
        (sum, value, situation) => sum + value / Math.max(fast.possible[situation] ?? 1, 1e-9),
        0,
      ),
    });
  }
  return candidates.sort((a, b) => b.rank - a.rank);
}

export function solve(level: Level | LevelIndex, options: SolveOptions = {}): Solution {
  const started = performance.now();
  const index = 'linkById' in level ? level : indexLevel(level);
  const limits = options.limits ?? defaultLimits;
  const fast = new FastEvaluator(index);
  const { possible, flowCount } = fast;
  const flows = [...index.level.flows].sort(
    (x, y) =>
      profiles[y.profile].weight * y.demand - profiles[x.profile].weight * x.demand ||
      x.id.localeCompare(y.id),
  );
  const candidates = flows.map((flow) => candidatesOf(index, fast, flow.id, limits));
  const bestAlone = candidates.map((list) =>
    possible.map((_, situation) =>
      Math.max(0, ...list.map((entry) => entry.alone[situation] ?? 0)),
    ),
  );
  // What the flows after position `depth` could earn at the most, each one alone.
  const rest = flows.map((_, depth) =>
    possible.map((__, situation) =>
      bestAlone.slice(depth + 1).reduce((sum, row) => sum + (row[situation] ?? 0), 0),
    ),
  );

  /** What the flows at positions 0..depth earn in the plan `slots`, per situation. */
  const placedBy = (slots: readonly (CompiledOption | undefined)[], depth: number): number[] => {
    const earned = fast.earned(slots);
    return possible.map((_, situation) =>
      flows
        .slice(0, depth + 1)
        .reduce(
          (sum, flow) => sum + (earned[situation * flowCount + fast.flowIndexOf(flow.id)] ?? 0),
          0,
        ),
    );
  };

  const scoreOfPlan = (plan: Plan): number => {
    const planSlots: (CompiledOption | undefined)[] = Array.from(
      { length: flowCount },
      () => undefined,
    );
    for (const [id, flowPlan] of Object.entries(plan)) {
      planSlots[fast.flowIndexOf(id)] = fast.compile(id, flowPlan);
    }
    return objective(placedBy(planSlots, flows.length - 1), possible);
  };

  // The incumbent: the better of the two simple strategies, so the search only looks for more.
  let bestPlan: Plan = shortestPathPlan(index);
  let best = scoreOfPlan(bestPlan);
  const balanced = loadBalancedPlan(index);
  const balancedScore = scoreOfPlan(balanced);
  if (balancedScore > best) {
    best = balancedScore;
    bestPlan = balanced;
  }

  // Improve the incumbent by coordinate descent: change one flow at a time to the option that
  // helps most, until nothing helps. This is only to start the proof with a good plan to beat.
  {
    const current: (CompiledOption | undefined)[] = Array.from(
      { length: flowCount },
      () => undefined,
    );
    const currentPlan: Record<string, FlowPlan> = { ...bestPlan };
    for (const [id, flowPlan] of Object.entries(bestPlan)) {
      current[fast.flowIndexOf(id)] = fast.compile(id, flowPlan);
    }
    let improved = true;
    for (let round = 0; improved && round < 6; round += 1) {
      improved = false;
      flows.forEach((flow, depth) => {
        const slot = fast.flowIndexOf(flow.id);
        for (const candidate of candidates[depth] ?? []) {
          const before = current[slot];
          current[slot] = candidate.compiled;
          const score = objective(placedBy(current, flows.length - 1), possible);
          if (score > best + 1e-12) {
            best = score;
            currentPlan[flow.id] = candidate.option;
            bestPlan = { ...currentPlan };
            improved = true;
          } else {
            current[slot] = before;
          }
        }
        // Keep `current` in step with the best plan after a change.
        const chosenNow = bestPlan[flow.id];
        current[slot] = chosenNow === undefined ? undefined : fast.compile(flow.id, chosenNow);
      });
    }
  }

  let explored = 0;
  const state = { complete: true };
  const stopped = (): boolean => !state.complete;
  const slots: (CompiledOption | undefined)[] = Array.from({ length: flowCount }, () => undefined);
  const chosen: Record<string, FlowPlan> = {};

  const search = (depth: number, before: readonly number[]): void => {
    const flow = flows[depth];
    if (flow === undefined || stopped()) {
      return;
    }
    const after = rest[depth] ?? [];
    const last = depth === flows.length - 1;
    const slot = fast.flowIndexOf(flow.id);
    for (const candidate of candidates[depth] ?? []) {
      // Cheap cut first: the flows placed so far cannot earn more than before, and the new flow
      // cannot earn more than it does alone.
      const quick = objective(
        before.map(
          (value, situation) => value + (candidate.alone[situation] ?? 0) + (after[situation] ?? 0),
        ),
        possible,
      );
      if (quick <= best + 1e-12) {
        continue;
      }
      explored += 1;
      if (
        options.timeLimitMs !== undefined &&
        explored % 256 === 0 &&
        performance.now() - started > options.timeLimitMs
      ) {
        state.complete = false;
        break;
      }
      slots[slot] = candidate.compiled;
      chosen[flow.id] = candidate.option;
      const placed = placedBy(slots, depth);
      if (last) {
        const score = objective(placed, possible);
        if (score > best + 1e-12) {
          best = score;
          bestPlan = { ...chosen };
        }
      } else {
        const bound = objective(
          placed.map((value, situation) => value + (after[situation] ?? 0)),
          possible,
        );
        if (bound > best + 1e-12) {
          search(depth + 1, placed);
        }
      }
      if (stopped()) {
        break;
      }
    }
    slots[slot] = undefined;
    Reflect.deleteProperty(chosen, flow.id);
  };
  search(
    0,
    possible.map(() => 0),
  );

  return {
    plan: bestPlan,
    score: best,
    explored,
    complete: state.complete,
    milliseconds: performance.now() - started,
  };
}
