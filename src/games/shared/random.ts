/**
 * Seeded random numbers for the games. The same seed always gives the same sequence, which makes
 * generators and rounds reproducible: a failing test prints its seed and can be replayed.
 *
 * mulberry32 is small and fast and good enough for games (it is not suitable for security).
 */

export interface Random {
  /** A number from 0 (included) to 1 (excluded). */
  next: () => number;
  /** A whole number from 0 up to, but not including, `limit`. */
  int: (limit: number) => number;
  /** One element of a non-empty list. */
  pick: <T>(items: readonly T[]) => T;
  /** A shuffled copy (Fisher-Yates). */
  shuffle: <T>(items: readonly T[]) => T[];
}

/** Turns any text into a 32 bit seed (FNV-1a), so seeds can be readable words. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A fresh seed for a round that should differ every time. */
export function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now() >>> 0;
}

export function createRandom(seed: number | string): Random {
  let state = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const int = (limit: number): number => {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`int(limit) needs a whole number of at least 1, got ${String(limit)}`);
    }
    return Math.floor(next() * limit);
  };

  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(Math.max(items.length, 1))];
    if (item === undefined) {
      throw new RangeError('pick() needs a non-empty list');
    }
    return item;
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = int(index + 1);
      const first = copy[index] as T;
      copy[index] = copy[other] as T;
      copy[other] = first;
    }
    return copy;
  };

  return { next, int, pick, shuffle };
}
