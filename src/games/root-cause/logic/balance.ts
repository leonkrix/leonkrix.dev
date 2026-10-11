import { type LevelRecord } from '../pool';
import { type Clue } from './types';

/**
 * The kinds of clue in a list, with the parts of a combination counted as clues of their own (a
 * "next to a plant and in a corner" is a next-to clue and a corner clue).
 */
export function clueKindsOf(clues: readonly Clue[]): string[] {
  return clues.flatMap((clue) =>
    clue.type === 'and' || clue.type === 'or'
      ? [clue.type, ...clue.parts.map((part) => part.type)]
      : [clue.type],
  );
}

function tally(kinds: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const kind of kinds) {
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}

/**
 * How uneven the kinds of clue are in a set of levels: the sum of the squares of how often each
 * kind is used in the whole set (a kind that is used a lot costs much), plus the same for every
 * level on its own (a level that repeats a kind costs). Zero would be a set that never repeats
 * anything; the smaller the better.
 */
export function imbalance(levels: readonly Pick<LevelRecord, 'clues'>[]): number {
  const whole = tally(levels.flatMap((level) => clueKindsOf(level.clues)));
  let total = 0;
  for (const count of whole.values()) {
    total += count * count;
  }
  for (const level of levels) {
    for (const count of tally(clueKindsOf(level.clues)).values()) {
      total += count * count;
    }
  }
  return total;
}

/**
 * Chooses one level for every id out of several candidates so that the kinds of clue are spread
 * as evenly as possible over the whole set, and within every level. It starts with the first
 * candidates and improves one id after the other until nothing gets better. The same input
 * always gives the same set.
 */
export function chooseBalanced(
  candidates: ReadonlyMap<string, readonly LevelRecord[]>,
): Map<string, LevelRecord> {
  const chosen = new Map<string, LevelRecord>();
  for (const [id, list] of candidates) {
    const first = list[0];
    if (first === undefined) {
      throw new RangeError(`No candidate for ${id}`);
    }
    chosen.set(id, first);
  }
  for (let pass = 0; pass < 50; pass += 1) {
    let improved = false;
    for (const [id, list] of candidates) {
      let best = chosen.get(id);
      let bestScore = imbalance([...chosen.values()]);
      for (const candidate of list) {
        chosen.set(id, candidate);
        const score = imbalance([...chosen.values()]);
        if (score < bestScore) {
          best = candidate;
          bestScore = score;
          improved = true;
        }
      }
      if (best !== undefined) {
        chosen.set(id, best);
      }
    }
    if (!improved) {
      break;
    }
  }
  return chosen;
}
