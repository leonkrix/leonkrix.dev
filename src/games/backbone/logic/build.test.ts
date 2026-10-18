import { describe, expect, it } from 'vitest';

import {
  maximalBuilds,
  optionalLinks,
  problemsOfBuilt,
  simpleBuild,
  spent,
  withBuilt,
} from './build';
import { diamond } from './fixtures';
import { indexLevel } from './graph';
import { singlePath } from './plan';
import { loadDesign, startState, toggleBuild, undo } from './play';
import { evaluate } from './simulate';
import { solveDesign } from './solver';
import { strategyScores } from './stars';
import type { Level } from './types';

/** The diamond where the way over the top is optional (and the lower way is the only one built) */
function building(): Level {
  const base = diamond({
    flows: [{ id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 16 }],
  });
  return {
    ...base,
    budget: 5,
    links: base.links.map((link) =>
      link.id === 'AB' || link.id === 'BD' ? { ...link, optional: true, cost: 3 } : link,
    ),
  };
}

describe('building', () => {
  const level = building();

  it('lists the optional cables and what they cost', () => {
    expect(optionalLinks(level).map((link) => link.id)).toEqual(['AB', 'BD']);
    expect(spent(level, ['AB'])).toBe(3);
    expect(spent(level, ['AB', 'BD'])).toBe(6);
  });

  it('turns a level and a set of built cables into a plain network', () => {
    expect(withBuilt(level, []).links.map((link) => link.id)).toEqual(['AC', 'CD']);
    expect(withBuilt(level, ['AB']).links.map((link) => link.id)).toEqual(['AB', 'AC', 'CD']);
    const plain = diamond();
    expect(withBuilt(plain, [])).toBe(plain);
  });

  it('knows what fits the budget', () => {
    expect(problemsOfBuilt(level, ['AB'])).toEqual([]);
    expect(problemsOfBuilt(level, ['AB', 'BD'])).toEqual(['the cables cost more than the budget']);
    expect(problemsOfBuilt(level, ['AC'])).toHaveLength(1);
  });

  it('tries only the sets that cannot be made bigger', () => {
    expect(
      maximalBuilds(level)
        .map((set) => set.join())
        .sort(),
    ).toEqual(['AB', 'BD']);
    expect(maximalBuilds({ ...level, budget: 6 }).map((set) => set.join())).toEqual(['AB,BD']);
    expect(maximalBuilds({ ...level, budget: 1 })).toEqual([[]]);
  });

  it('builds the simple way: most capacity for the price', () => {
    expect(simpleBuild(level)).toEqual(['AB']);
  });

  it('cannot route over a cable that is not built', () => {
    const plain = indexLevel(withBuilt(level, []));
    expect(evaluate(plain, { f1: singlePath(['A', 'B', 'D']) }).score).toBe(0);
  });

  it('finds the best design, and it is at least as good as the simple strategies', () => {
    const solution = solveDesign(level);
    expect(solution.complete).toBe(true);
    expect(solution.built).toHaveLength(1);
    const scores = strategyScores(level);
    expect(solution.score).toBeGreaterThanOrEqual(
      Math.max(scores.shortest, scores.balanced) - 1e-12,
    );
    expect(evaluate(indexLevel(withBuilt(level, solution.built)), solution.plan).score).toBeCloseTo(
      solution.score,
      9,
    );
  });
});

describe('building in the game', () => {
  const level = building();

  it('builds within the budget and refuses beyond it', () => {
    let state = startState(level);
    expect(state.index.level.links).toHaveLength(2);
    state = toggleBuild(state, 'AB');
    expect(state.built).toEqual(['AB']);
    expect(state.index.level.links).toHaveLength(3);
    const refused = toggleBuild(state, 'BD');
    expect(refused.built).toEqual(['AB']);
    expect(refused.message).toContain('only 2 is left');
  });

  it('takes a cable away again, with the paths over it, and undoes that', () => {
    let state = toggleBuild(startState(level), 'AB');
    state = toggleBuild(state, 'AB');
    expect(state.built).toEqual([]);
    state = undo(state);
    expect(state.built).toEqual(['AB']);
  });

  it('loses the flows that used the cable that is taken away', () => {
    let state = startState(level);
    state = toggleBuild(state, 'AB');
    state = { ...state, plan: { f1: singlePath(['A', 'C', 'D']) } };
    state = toggleBuild(state, 'AB');
    expect(Object.keys(state.plan)).toEqual(['f1']);
    const over = loadDesign(startState(level), { f1: singlePath(['A', 'B', 'D']) }, ['AB']);
    expect(over.assisted).toBe(true);
    const lost = toggleBuild(over, 'AB');
    expect(Object.keys(lost.plan)).toEqual([]);
    expect(lost.message).toContain('lost the path');
  });
});
