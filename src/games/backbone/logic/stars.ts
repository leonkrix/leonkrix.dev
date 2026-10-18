import { loadBalancedPlan, shortestPathPlan } from './baselines';
import { indexLevel, type LevelIndex } from './graph';
import { evaluate } from './simulate';
import type { Level } from './types';

/**
 * Stars. A level is measured against three plans: shortest path (`shortest`), load balanced
 * (`balanced`) and the proven best plan (`best`).
 *
 * One star: at least as good as shortest path. Two stars: better than both simple strategies, and
 * at least 40 percent of the way from shortest path to the best plan. Three stars: within 5 percent
 * of the distance from shortest path to the best plan. A level is only admitted when those steps
 * are real (see `isAdmissible`), so every star means something.
 */

export interface Baselines {
  shortest: number;
  balanced: number;
  best: number;
}

export interface Thresholds {
  one: number;
  two: number;
  three: number;
}

/** A tiny tolerance so that a plan equal to a threshold counts as reaching it. */
const EPSILON = 1e-9;

export function starThresholds({ shortest, balanced, best }: Baselines): Thresholds {
  const gap = best - shortest;
  const better = Math.max(shortest, balanced);
  return {
    one: shortest,
    two: Math.max(better, shortest + 0.4 * gap),
    three: shortest + 0.95 * gap,
  };
}

/** How many stars a score earns, 0 to 3. */
export function starsFor(score: number, thresholds: Thresholds): 0 | 1 | 2 | 3 {
  if (score >= thresholds.three - EPSILON) {
    return 3;
  }
  if (score >= thresholds.two - EPSILON) {
    return 2;
  }
  if (score >= thresholds.one - EPSILON) {
    return 1;
  }
  return 0;
}

/**
 * Whether a level leaves room for the stars: the best plan beats the better simple strategy by
 * a clear margin, and that strategy leaves room below three stars.
 */
export function isAdmissible({ shortest, balanced, best }: Baselines): boolean {
  const better = Math.max(shortest, balanced);
  return best - better >= Math.max(0.04, 0.08 * better) && best > shortest;
}

/** The scores of the two simple strategies of a level (the best plan comes from the solver). */
export function strategyScores(
  level: Level | LevelIndex,
): Pick<Baselines, 'shortest' | 'balanced'> {
  const index = 'linkById' in level ? level : indexLevel(level);
  return {
    shortest: evaluate(index, shortestPathPlan(index)).score,
    balanced: evaluate(index, loadBalancedPlan(index)).score,
  };
}
