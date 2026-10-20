import { describe, expect, it } from 'vitest';

import { loadBalancedPlan, shortestPathPlan } from './baselines';
import { allRules, diamond, randomLevel } from './fixtures';
import { indexLevel, type LevelIndex } from './graph';
import { flowOptions } from './options';
import { problemsOfPlan } from './plan';
import { evaluate } from './simulate';
import { earnedByFlow, objective, possibleValues, solve } from './solver';
import type { FlowPlan, Level, Plan, Rules } from './types';

function scoreOf(index: LevelIndex, plan: Plan): number {
  return evaluate(index, plan).score;
}

/** Tries every combination of the raw options, with no pruning and no merging of alike options. */
function bruteForce(index: LevelIndex, pathLimit: number): number {
  const lists = index.level.flows.map((flow) => flowOptions(index, flow, { pathLimit }));
  let best = -1;
  const chosen: Record<string, FlowPlan> = {};
  const walk = (depth: number): void => {
    const flow = index.level.flows[depth];
    if (flow === undefined) {
      best = Math.max(best, scoreOf(index, chosen));
      return;
    }
    for (const option of lists[depth] ?? []) {
      chosen[flow.id] = option;
      walk(depth + 1);
    }
  };
  walk(0);
  return best;
}

const everyday: Rules = {
  split: false,
  backup: true,
  redundancy: true,
  throttle: true,
  stages: false,
  queues: false,
};

describe('the baselines', () => {
  it('send every flow on one path and nothing else', () => {
    const level = randomLevel(3);
    for (const plan of [shortestPathPlan(level), loadBalancedPlan(level)]) {
      expect(problemsOfPlan(level, plan)).toEqual([]);
      expect(Object.keys(plan)).toHaveLength(level.flows.length);
      for (const flowPlan of Object.values(plan)) {
        expect(flowPlan.redundancy).toBe(0);
        expect(flowPlan.backup).toBeUndefined();
        expect(flowPlan.stages).toHaveLength(1);
        expect(flowPlan.stages[0]?.paths).toHaveLength(1);
      }
    }
  });

  it('shortest path takes the fast way for everybody, load balanced spreads the load', () => {
    const level = diamond({
      flows: [
        { id: 'f1', name: 'one', source: 'A', target: 'D', profile: 'web', demand: 8 },
        { id: 'f2', name: 'two', source: 'A', target: 'D', profile: 'web', demand: 8 },
      ],
    });
    const shortest = shortestPathPlan(level);
    expect(shortest.f1?.stages[0]?.paths[0]?.nodes).toEqual(['A', 'B', 'D']);
    expect(shortest.f2?.stages[0]?.paths[0]?.nodes).toEqual(['A', 'B', 'D']);
    const balanced = loadBalancedPlan(level);
    const used = [balanced.f1, balanced.f2].map((plan) =>
      plan?.stages[0]?.paths[0]?.nodes.join(''),
    );
    expect(new Set(used).size).toBe(2);
    expect(scoreOf(indexLevel(level), balanced)).toBeGreaterThan(
      scoreOf(indexLevel(level), shortest),
    );
  });
});

describe('the solver', () => {
  it('finds the split that two shortest paths cannot', () => {
    const level = diamond({
      flows: [{ id: 'f1', name: 'big', source: 'A', target: 'D', profile: 'web', demand: 16 }],
    });
    const solution = solve(level);
    expect(solution.complete).toBe(true);
    expect(solution.score).toBeGreaterThan(scoreOf(indexLevel(level), shortestPathPlan(level)));
    expect(solution.score).toBeCloseTo(1, 6);
    expect(problemsOfPlan(level, solution.plan)).toEqual([]);
  });

  it('reports a score that the stress test confirms', () => {
    for (const seed of [1, 2, 3]) {
      const level = { ...randomLevel(seed, 6, 3), rules: everyday };
      const index = indexLevel(level);
      const solution = solve(index);
      expect(scoreOf(index, solution.plan)).toBeCloseTo(solution.score, 9);
      expect(problemsOfPlan(index, solution.plan)).toEqual([]);
    }
  });

  it('is never worse than a simple strategy', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const level = { ...randomLevel(seed, 7, 4), rules: everyday };
      const index = indexLevel(level);
      const best = Math.max(
        scoreOf(index, shortestPathPlan(index)),
        scoreOf(index, loadBalancedPlan(index)),
      );
      expect(solve(index).score, `seed ${String(seed)}`).toBeGreaterThanOrEqual(best - 1e-12);
    }
  }, 30_000);

  it('agrees with trying every combination', () => {
    const rulesets = [
      {
        split: false,
        backup: true,
        redundancy: true,
        throttle: true,
        stages: false,
        queues: false,
      },
      {
        split: true,
        backup: false,
        redundancy: false,
        throttle: true,
        stages: false,
        queues: false,
      },
      {
        split: false,
        backup: false,
        redundancy: true,
        throttle: false,
        stages: true,
        queues: false,
      },
    ];
    for (const [position, rules] of rulesets.entries()) {
      for (let seed = 1; seed <= 4; seed += 1) {
        const base = randomLevel(seed * 11 + position, 5, 2);
        const level: Level = { ...base, rules };
        const index = indexLevel(level);
        const limits = { pathLimit: 3 };
        const exact = solve(index, { limits });
        const brute = bruteForce(index, limits.pathLimit);
        const heuristic = Math.max(
          scoreOf(index, shortestPathPlan(index)),
          scoreOf(index, loadBalancedPlan(index)),
        );
        // The solver also starts from the simple strategies, which may use a longer path than the options.
        expect(exact.score, `rules ${String(position)}, seed ${String(seed)}`).toBeCloseTo(
          Math.max(brute, heuristic),
          9,
        );
      }
    }
  }, 60_000);

  it('can stop on a time limit and still hands back a valid plan', () => {
    const level = { ...randomLevel(4, 7, 4), rules: allRules };
    const solution = solve(level, { timeLimitMs: 1 });
    expect(problemsOfPlan(level, solution.plan)).toEqual([]);
    expect(solution.score).toBeGreaterThan(0);
  }, 30_000);
});

describe('the helpers', () => {
  it('counts the worst situation twice', () => {
    expect(objective([5, 2], [10, 10])).toBeCloseTo((0.5 + 0.2 + 0.2) / 3, 9);
    expect(objective([], [])).toBe(1);
  });

  it('adds up what the flows earned to the score of the stress test', () => {
    const level = randomLevel(8);
    const index = indexLevel(level);
    const plan = shortestPathPlan(index);
    const evaluation = evaluate(index, plan);
    const earned = [...earnedByFlow(index, evaluation).values()];
    const perSituation = possibleValues(index).map((_, situation) =>
      earned.reduce((sum, values) => sum + (values[situation] ?? 0), 0),
    );
    expect(objective(perSituation, possibleValues(index))).toBeCloseTo(evaluation.score, 9);
    expect(allRules.split).toBe(true);
  });
});
