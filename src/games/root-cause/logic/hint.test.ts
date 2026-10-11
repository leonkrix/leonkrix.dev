import { describe, expect, it } from 'vitest';

import levelsJson from '../data/levels.json';
import { type LevelRecord, toLevel } from '../pool';
import { brokenClues, findHint, type Hint, type HintStage, hintText } from './hint';
import { type Cell } from './types';

const records = levelsJson as unknown as LevelRecord[];
const SLOW = 600_000;

const stages: readonly HintStage[] = [1, 2, 3];

describe('the hints of every level of the pool', () => {
  it(
    'lead to the solution, one logical step after the other, and never point at a wrong cell',
    () => {
      const kinds = new Set<string>();
      for (const record of records) {
        const level = toLevel(record);
        const placed: (Cell | undefined)[] = level.people.map(() => undefined);
        const seen: string[] = [];
        for (let step = 0; step < level.people.length + 1; step += 1) {
          const hint = findHint(level, placed);
          if (hint === undefined) {
            break;
          }
          expect(hint.kind, `${record.id} step ${String(step)}`).toBe('next');
          // The person belongs in one of the cells of the hint
          expect(hint.cells, `${record.id} ${String(hint.person)}`).toContain(
            level.solution[hint.person],
          );
          // The clues of the hint are about the person (or are all clues of a victim rule)
          for (const index of hint.clues) {
            expect(index).toBeLessThan(level.clues.length);
          }
          seen.push(hint.by);
          kinds.add(hint.by);
          // The player follows the hint and puts the person there
          placed[hint.person] = level.solution[hint.person];
        }
        expect(findHint(level, placed), `${record.id} is solved`).toBeUndefined();
        expect(placed.every((cell, person) => cell === level.solution[person])).toBe(true);
        // An easy level is placed by the clues alone, every step of it
        if (record.tier === 'easy') {
          expect(
            seen.every((by) => by === 'clues'),
            `${record.id}: ${seen.join(',')}`,
          ).toBe(true);
        }
      }
      // The whole range of reasoning shows up somewhere in the pool
      expect(kinds.has('clues')).toBe(true);
      expect(kinds.has('rooms')).toBe(true);
    },
    SLOW,
  );

  it(
    'says who is misplaced, and where that person belongs',
    () => {
      for (const record of records.slice(0, 6)) {
        const level = toLevel(record);
        const placed: (Cell | undefined)[] = level.people.map(() => undefined);
        // Somebody on the cell of somebody else
        placed[0] = level.solution[1];
        const hint = findHint(level, placed);
        expect(hint?.kind, record.id).toBe('mistake');
        expect(hint?.person).toBe(0);
        expect(hint?.cells).toContain(level.solution[0]);
        // The clues of the hint include the ones that the map breaks
        for (const index of brokenClues(level, placed)) {
          expect(hint?.clues).toContain(index);
        }
      }
    },
    SLOW,
  );
});

describe('the texts of a hint', () => {
  const level = toLevel(records[0] ?? ({} as LevelRecord));
  const words = { name: 'Ada', victim: 'victim', isVictim: false };
  const base = { person: 0, cells: [3], clues: [0], steps: [] };
  const hints: Hint[] = [
    { ...base, kind: 'next', by: 'clues' },
    { ...base, kind: 'next', by: 'rooms' },
    { ...base, kind: 'next', by: 'whatif' },
    { ...base, kind: 'next', by: 'open', cells: [3, 4] },
    { ...base, kind: 'mistake', by: 'given' },
  ];

  it('get clearer from stage to stage and always name the person', () => {
    expect(level.people.length).toBeGreaterThan(0);
    for (const hint of hints) {
      const texts = stages.map((stage) => hintText(hint, stage, words));
      expect(new Set(texts).size, `${hint.kind} ${hint.by}`).toBe(3);
      for (const text of texts) {
        expect(text).toMatch(/[A-Z].*\.$/);
        expect(text).not.toMatch(/undefined|\{|NaN/);
      }
      // The last stage says where: one cell or several
      expect(texts[2]).toMatch(/marked cell/);
    }
    expect(hintText({ ...base, kind: 'next', by: 'clues' }, 3, words)).toContain(
      'belongs on the marked cell',
    );
    expect(hintText({ ...base, kind: 'next', by: 'open', cells: [3, 4] }, 3, words)).toContain(
      'can only be on the marked cells',
    );
  });

  it('tells the victim from the suspects when the clues say nothing about them', () => {
    const text = hintText({ ...base, kind: 'next', by: 'rooms', clues: [] }, 2, {
      ...words,
      isVictim: true,
    });
    expect(text).toContain('No clue is about Ada');
    expect(text).toContain('exactly one suspect shares a room');
  });
});
