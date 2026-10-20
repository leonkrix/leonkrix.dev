import type { LevelIndex } from './graph';
import { profiles } from './profiles';
import type { Level, ProfileId } from './types';

/**
 * How delay is shown. The model counts delay in units (a cable has 1 to 4, a voice call may take
 * 6 before it loses value); the player sees milliseconds, one unit being 5 ms, so that the numbers
 * mean something: a cable of 2 units is 10 ms and a call is fine up to 30 ms.
 */
export const MS_PER_DELAY = 5;

export function delayMs(units: number): number {
  return Math.round(units * MS_PER_DELAY);
}

/** What a kind of traffic can take before it loses value, in milliseconds (`undefined`: it never minds). */
export function budgetMs(profile: ProfileId): number | undefined {
  const budget = profiles[profile].latencyBudget;
  return budget === undefined ? undefined : delayMs(budget);
}

/**
 * Whether the delay of the cables is shown (and talked about): from the chapter about latency on,
 * that is in a level with traffic that must be fast, and in every level of the chapters after it
 * (they have the rules of priorities and more, which the chapter about latency does not have).
 */
export function showsDelay(level: Level): boolean {
  return (
    level.rules.throttle ||
    level.flows.some((flow) => {
      const budget = profiles[flow.profile].latencyBudget;
      return budget !== undefined && budget <= 8;
    })
  );
}

/** The delay of the cables along the nodes of a route (or the first part of one), in units, on an empty network. */
export function routeDelay(index: LevelIndex, nodes: readonly string[]): number {
  let total = 0;
  for (let at = 1; at < nodes.length; at += 1) {
    const step = index.neighbours
      .get(nodes[at - 1] ?? '')
      ?.find((entry) => entry.node === nodes[at]);
    total += step === undefined ? 0 : (index.linkById.get(step.link)?.delay ?? 0);
  }
  return total;
}
