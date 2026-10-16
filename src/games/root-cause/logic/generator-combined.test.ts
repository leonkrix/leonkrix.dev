// The tests of generator.test.ts, split into files that run side by side (every test is the same, only the files are more): combined clues

import { describe, expect, it } from 'vitest';

import { Board } from './board';
import { check, type Context, isStatic, UNPLACED } from './clues';
import { generateLevel } from './generator';
import { defined, SKINS, SLOW } from './generator-test-helpers';

describe('combined clues', () => {
  it(
    'let each part rule something out that the other does not (checked for the parts that depend on one cell)',
    () => {
      let combined = 0;
      for (const skin of SKINS) {
        for (let seed = 0; seed < 12; seed += 1) {
          const made = generateLevel(skin, 6, 'hard', `parts-${skin.id}-${String(seed)}`);
          const level = defined(made, 'a level').level;
          const board = new Board(level.layout, level.kinds);
          const context: Context = { board, people: level.people, victim: level.people.length - 1 };
          const free = Array.from({ length: board.cellCount }, (_, cell) => cell).filter(
            (cell) => !board.blocked.has(cell),
          );
          for (const clue of level.clues) {
            if (clue.type !== 'and' && clue.type !== 'or') {
              continue;
            }
            const [first, second] = clue.parts;
            if (!isStatic(first) || !isStatic(second)) {
              continue;
            }
            const cellsOf = (part: typeof first): Set<number> =>
              new Set(
                free.filter(
                  (cell) =>
                    check(
                      part,
                      context,
                      level.people.map((_, person) => (person === clue.person ? cell : UNPLACED)),
                    ) === true,
                ),
              );
            const a = cellsOf(first);
            const b = cellsOf(second);
            const both = [...a].filter((cell) => b.has(cell)).length;
            combined += 1;
            expect(both, `${clue.type}: one part follows from the other`).toBeLessThan(a.size);
            expect(both, `${clue.type}: one part follows from the other`).toBeLessThan(b.size);
            expect(a.size, 'a part rules nothing out').toBeLessThan(
              clue.type === 'and' ? free.length : free.length + 1,
            );
          }
        }
      }
      expect(combined).toBeGreaterThan(0);
    },
    SLOW,
  );
});
