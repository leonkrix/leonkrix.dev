// The tests of generator.test.ts, split into files that run side by side (every test is the same, only the files are more): the same person, and the way in

import { describe, expect, it } from 'vitest';

import { axisSubjects, directShare, generateLevel } from './generator';
import { defined, SKINS, SLOW } from './generator-test-helpers';
import { directlySolved } from './propagation';

describe('a row and a column clue about the same person', () => {
  it('name the people of the row and column clues of a list', () => {
    expect(
      axisSubjects([
        { type: 'line', person: 2, line: 'lastRow' },
        { type: 'rowCol', person: 0, axis: 'col', index: 1 },
        { type: 'corner', person: 1 },
      ]),
    ).toEqual({ row: [2], col: [0] });
  });

  it(
    'are never in the same level, as together they name one cell (small easy levels most of all)',
    () => {
      let both = 0;
      for (const skin of SKINS) {
        for (const size of [4, 5]) {
          for (let seed = 0; seed < 30; seed += 1) {
            const made = generateLevel(
              skin,
              size,
              'easy',
              `one-cell-${skin.id}-${String(size)}-${String(seed)}`,
            );
            const { row, col } = axisSubjects(defined(made, 'a level').level.clues);
            if (row.length > 0 && col.length > 0) {
              both += 1;
            }
            expect(
              row.filter((person) => col.includes(person)),
              `${skin.id} ${String(size)} seed ${String(seed)}`,
            ).toEqual([]);
          }
        }
      }
      // The test would mean little if no level had both kinds at all
      expect(both).toBeGreaterThan(0);
    },
    SLOW,
  );
});

describe('the way in on a medium level', () => {
  it(
    'has the clues alone place at least half of the people',
    () => {
      for (const skin of SKINS) {
        for (const size of [5, 6, 7]) {
          for (let seed = 0; seed < 2; seed += 1) {
            const made = generateLevel(
              skin,
              size,
              'medium',
              `direct-${skin.id}-${String(size)}-${String(seed)}`,
            );
            const level = defined(made, 'a level').level;
            expect(directlySolved(level)).toBeGreaterThanOrEqual(directShare('medium', size));
          }
        }
      }
    },
    SLOW,
  );
});
