import type { Level, NetLink } from './types';

/**
 * The Build phase (chapter 7). Some cables of a level are optional: they exist only when the
 * player builds them, each costs something, and the budget limits how much can be built. Everything
 * else in the game works on a plain network, so a level plus the set of built cables is turned into
 * one (`withBuilt`) and the rest does not know about building.
 */

export function optionalLinks(level: Level): NetLink[] {
  return level.links.filter((link) => link.optional === true);
}

export function costOf(link: NetLink): number {
  return link.cost ?? 0;
}

export function spent(level: Level, built: readonly string[]): number {
  return optionalLinks(level)
    .filter((link) => built.includes(link.id))
    .reduce((sum, link) => sum + costOf(link), 0);
}

/** The level as it is when exactly these optional cables are built. */
export function withBuilt(level: Level, built: readonly string[]): Level {
  const optional = optionalLinks(level);
  if (optional.length === 0) {
    return level;
  }
  return {
    ...level,
    links: level.links.filter((link) => link.optional !== true || built.includes(link.id)),
  };
}

/** Whether a set of cables can be built: they are optional cables of the level and they fit the budget. */
export function problemsOfBuilt(level: Level, built: readonly string[]): string[] {
  const problems: string[] = [];
  const optional = new Set(optionalLinks(level).map((link) => link.id));
  for (const id of built) {
    if (!optional.has(id)) {
      problems.push(`${id} is not a cable that can be built`);
    }
  }
  if (spent(level, built) > (level.budget ?? 0)) {
    problems.push('the cables cost more than the budget');
  }
  return problems;
}

/**
 * The sets of cables worth trying: every set that fits the budget and cannot be made bigger.
 * Another cable never makes a network worse, so a set that is not maximal is never better.
 */
export function maximalBuilds(level: Level): string[][] {
  const optional = optionalLinks(level);
  const budget = level.budget ?? 0;
  const result: string[][] = [];
  const walk = (at: number, chosen: NetLink[], used: number): void => {
    if (at === optional.length) {
      const rest = optional.filter((link) => !chosen.includes(link));
      if (rest.every((link) => used + costOf(link) > budget)) {
        result.push(chosen.map((link) => link.id));
      }
      return;
    }
    const link = optional[at];
    if (link === undefined) {
      return;
    }
    if (used + costOf(link) <= budget) {
      walk(at + 1, [...chosen, link], used + costOf(link));
    }
    walk(at + 1, chosen, used);
  };
  walk(0, [], 0);
  return result;
}

/**
 * What the two simple strategies build: the cables with the most capacity for their price, as
 * long as the budget lasts. (They know nothing about the flows.)
 */
export function simpleBuild(level: Level): string[] {
  const budget = level.budget ?? 0;
  const ranked = [...optionalLinks(level)].sort(
    (a, b) =>
      b.capacity / Math.max(costOf(b), 1) - a.capacity / Math.max(costOf(a), 1) ||
      a.id.localeCompare(b.id),
  );
  const built: string[] = [];
  let used = 0;
  for (const link of ranked) {
    if (used + costOf(link) <= budget) {
      built.push(link.id);
      used += costOf(link);
    }
  }
  return built;
}
