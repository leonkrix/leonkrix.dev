// The tests of generator.test.ts, split into files that run side by side (every test is the same, only the files are more): generateLevel in Outage

import { describe, expect, it } from 'vitest';

import { outage } from '../data/skins';
import { generateLevel, problemsOf, tierOf } from './generator';
import { defined, SLOW } from './generator-test-helpers';
import { rate } from './propagation';
import { type Skin } from './skin';
import { type Tier } from './types';

describe('generateLevel', () => {
  const cases: { skin: Skin; size: number; tier: Tier }[] = [outage].flatMap((skin) =>
    [
      { size: 4, tier: 'easy' as const },
      { size: 5, tier: 'easy' as const },
      { size: 5, tier: 'medium' as const },
      { size: 6, tier: 'medium' as const },
      { size: 4, tier: 'hard' as const },
      { size: 6, tier: 'hard' as const },
    ].map((entry) => ({ skin, ...entry })),
  );

  it.each(cases)(
    'makes verified $tier puzzles of $size by $size in $skin.id',
    ({ skin, size, tier }) => {
      for (let seed = 0; seed < 3; seed += 1) {
        const made = generateLevel(
          skin,
          size,
          tier,
          `test2-${skin.id}-${String(size)}-${tier}-${String(seed)}`,
        );
        const level = defined(made, `a level (seed ${String(seed)})`).level;
        // Two independent solvers, structure, names, clues: nothing may be wrong
        expect(problemsOf(level), `seed ${String(seed)}`).toEqual([]);
        expect(made?.tier).toBe(tier);
        expect(tierOf(rate(level))).toBe(tier);
        expect(level.people).toHaveLength(size);
        expect(level.layout.size).toBe(size);
        expect(level.layout.rooms).toHaveLength(level.layout.roomCount);
      }
    },
    SLOW,
  );
});
