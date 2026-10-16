// The tests of generator.test.ts, split into files that run side by side (every test is the same, only the files are more): rows and columns

import { describe, expect, it } from 'vitest';

import { axesOf, generateLevel } from './generator';
import { defined, SKINS, SLOW } from './generator-test-helpers';

describe('rows and columns', () => {
  it(
    'has at most one clue about a row and one about a column in a level',
    () => {
      for (const skin of SKINS) {
        for (const tier of ['easy', 'medium', 'hard'] as const) {
          for (let seed = 0; seed < 4; seed += 1) {
            const made = generateLevel(skin, 6, tier, `axes-${skin.id}-${tier}-${String(seed)}`);
            const level = defined(made, 'a level').level;
            const axes = level.clues.flatMap((clue) => axesOf(clue));
            expect(
              axes.filter((axis) => axis === 'row').length,
              `rows, seed ${String(seed)}`,
            ).toBeLessThanOrEqual(1);
            expect(
              axes.filter((axis) => axis === 'col').length,
              `columns, seed ${String(seed)}`,
            ).toBeLessThanOrEqual(1);
          }
        }
      }
    },
    SLOW,
  );
});
