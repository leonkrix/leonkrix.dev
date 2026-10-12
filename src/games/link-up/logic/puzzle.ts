import { type Random } from '../../shared/random';
import { type Category, type Term } from '../data/define';

/** A puzzle has four groups of four terms. */
export const GROUP_COUNT = 4;
export const GROUP_SIZE = 4;
export const TILE_COUNT = GROUP_COUNT * GROUP_SIZE;

/** One tile of the board: a term, and the number of the group it belongs to. */
export interface Tile {
  /** The name of the term, which is unique in a puzzle (and in the whole pool) */
  id: string;
  name: string;
  definition: string;
  /** 0 to 3 */
  group: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  terms: readonly Term[];
}

export interface Puzzle {
  groups: readonly Group[];
  /** The 16 tiles, group by group (the game shows them in a shuffled order) */
  tiles: readonly Tile[];
}

/** The key of a pair of categories, the same for both orders. */
export function pairKey(first: string, second: string): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

/** The pairs of categories that must not meet, as a set of keys for quick lookups. */
export function conflictKeys(
  conflicts: readonly (readonly [string, string])[],
): ReadonlySet<string> {
  return new Set(conflicts.map(([first, second]) => pairKey(first, second)));
}

/**
 * The number of ways to sort the tiles into the groups, as far as the data says which tile fits
 * which group: a tile fits every group whose category lists a term with the same name. The
 * puzzle is only fair when there is exactly one way, which is the group each tile was made for.
 * Counting stops at 2, as nobody needs to know more than "more than one".
 */
export function countSolutions(puzzle: Puzzle, categories: readonly Category[]): number {
  const byId = new Map(categories.map((category) => [category.id, category]));
  // For every tile, the groups it fits
  const fits = puzzle.tiles.map((tile) =>
    puzzle.groups.flatMap((group, index) => {
      const category = byId.get(group.id);
      return category?.terms.some((term) => term.name === tile.name) === true ? [index] : [];
    }),
  );
  const room = Array.from({ length: puzzle.groups.length }, () => GROUP_SIZE);
  let found = 0;

  const place = (tile: number): void => {
    if (found >= 2) {
      return;
    }
    if (tile === fits.length) {
      found += 1;
      return;
    }
    for (const group of fits[tile] ?? []) {
      if ((room[group] ?? 0) > 0) {
        room[group] = (room[group] ?? 0) - 1;
        place(tile + 1);
        room[group] = (room[group] ?? 0) + 1;
      }
    }
  };
  place(0);
  return found;
}

const ATTEMPTS = 500;

/** Whether two of the categories must not meet (see conflicts in the data). */
function clashes(chosen: readonly { id: string }[], blocked: ReadonlySet<string>): boolean {
  return chosen.some((first, index) =>
    chosen.slice(index + 1).some((second) => blocked.has(pairKey(first.id, second.id))),
  );
}

/**
 * Four terms from each of four categories, or null when the puzzle is not clean: a term that two of
 * the groups share, or more than one way to sort the tiles (checked against `pool`).
 */
function buildPuzzle(
  chosen: readonly Category[],
  random: Random,
  pool: readonly Category[],
): Puzzle | null {
  const groups: Group[] = chosen.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    terms: random.shuffle(category.terms).slice(0, GROUP_SIZE),
  }));
  const tiles = groups.flatMap((group, index) =>
    group.terms.map((term) => ({
      id: term.name,
      name: term.name,
      definition: term.definition,
      group: index,
    })),
  );
  if (new Set(tiles.map((tile) => tile.id)).size !== TILE_COUNT) {
    return null;
  }
  const puzzle = { groups, tiles };
  return countSolutions(puzzle, pool) === 1 ? puzzle : null;
}

/**
 * Makes a puzzle: four categories that do not conflict, four terms of each. The same random
 * numbers always give the same puzzle. A puzzle is only returned after it has been checked to
 * have exactly one solution.
 */
export function generatePuzzle(
  categories: readonly Category[],
  conflicts: readonly (readonly [string, string])[],
  random: Random,
): Puzzle {
  const blocked = conflictKeys(conflicts);
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const chosen = random.shuffle(categories).slice(0, GROUP_COUNT);
    if (clashes(chosen, blocked)) {
      continue;
    }
    const puzzle = buildPuzzle(chosen, random, categories);
    if (puzzle !== null) {
      return puzzle;
    }
  }
  throw new Error('No puzzle found: the categories conflict too much');
}

/**
 * The same puzzle as `generatePuzzle` makes from the same random numbers, for a pool that is too big
 * to load at once: the choice is made from a list of ids alone, and only the four categories that
 * were chosen are loaded. The solutions are counted among those four, which is the whole pool as
 * far as these tiles are concerned, because no term name is used by two categories (a data test).
 */
export async function generatePuzzleLazily(
  entries: readonly { id: string }[],
  conflicts: readonly (readonly [string, string])[],
  load: (ids: readonly string[]) => Promise<readonly Category[]>,
  random: Random,
): Promise<Puzzle> {
  const blocked = conflictKeys(conflicts);
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const chosen = random.shuffle(entries).slice(0, GROUP_COUNT);
    if (clashes(chosen, blocked)) {
      continue;
    }
    const loaded = await load(chosen.map((entry) => entry.id));
    const puzzle = buildPuzzle(loaded, random, loaded);
    if (puzzle !== null) {
      return puzzle;
    }
  }
  throw new Error('No puzzle found: the categories conflict too much');
}
