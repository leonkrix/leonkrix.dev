import { describe, expect, it } from 'vitest';

import levelsJson from '../data/levels.json';
import { type LevelRecord, toLevel } from '../pool';
import { explain, type ExplainStep, type ExplainWords, explanationLines } from './explain';
import { brokenClues, findHint } from './hint';
import { type Cell } from './types';

const records = levelsJson as unknown as LevelRecord[];
const SLOW = 600_000;

/** Counts of the cells that are left, in the order of the steps (the result has no count) */
function counts(steps: readonly ExplainStep[]): number[] {
  return steps.flatMap((step) =>
    'cells' in step && typeof step.cells === 'number' ? [step.cells] : [],
  );
}

function wordsOf(record: LevelRecord, person: number): ExplainWords {
  return {
    name: (other) => record.people[other]?.name ?? '?',
    clue: (index) => `clue ${String(index)}`,
    where: (cell) => `cell ${String(cell)}`,
    victim: 'victim',
    person,
    isVictim: person === record.people.length - 1,
  };
}

describe('the explanation of a hint', () => {
  it(
    'starts with the clues, only narrows the cells down, and ends where the hint points',
    () => {
      for (const record of records) {
        const level = toLevel(record);
        const placed: (Cell | undefined)[] = level.people.map(() => undefined);
        for (let step = 0; step < level.people.length; step += 1) {
          const hint = findHint(level, placed);
          if (hint === undefined) {
            break;
          }
          const id = `${record.id} step ${String(step)}`;
          expect(hint.steps[0]?.kind, id).toBe('clues');
          const last = hint.steps.at(-1);
          expect(last?.kind, id).toBe('result');
          expect(last && 'cells' in last ? last.cells : [], id).toEqual(hint.cells);
          // The number of cells never grows, and ends with the cells of the hint
          const left = counts(hint.steps);
          expect(left, id).toEqual([...left].sort((a, b) => b - a));
          expect(left.at(-1) ?? 0, id).toBeGreaterThanOrEqual(hint.cells.length);
          // Only the steps that are needed: the cells of the hint are reached by the last step with a count and not before
          expect(left.filter((n) => n === hint.cells.length).length, id).toBeLessThanOrEqual(1);

          // The hint marks every clue that limits the person
          const first = hint.steps[0];
          for (const index of first?.kind === 'clues' ? first.clues : []) {
            expect(hint.clues, id).toContain(index);
          }
          // Easy levels never need more than rows, columns and a single cell
          if (record.tier === 'easy') {
            for (const part of hint.steps) {
              expect(['clues', 'taken', 'chain', 'result'], id).toContain(part.kind);
            }
          }
          // One sentence per step, all complete
          const lines = explanationLines(hint.steps, wordsOf(record, hint.person));
          expect(lines, id).toHaveLength(hint.steps.length);
          for (const line of lines) {
            expect(line, id).toMatch(/^[A-Z].*[.]$/);
            expect(line, id).not.toMatch(/undefined|NaN|\[object/);
          }
          placed[hint.person] = level.solution[hint.person];
        }
      }
    },
    SLOW,
  );

  it(
    'begins with the broken clues when a person stands in the wrong place',
    () => {
      for (const record of records.slice(0, 12)) {
        const level = toLevel(record);
        const placed: (Cell | undefined)[] = level.people.map(() => undefined);
        placed[0] = level.solution[1];
        const hint = findHint(level, placed);
        expect(hint?.kind, record.id).toBe('mistake');
        const broken = brokenClues(level, placed);
        expect(hint?.steps[0]?.kind, record.id).toBe(broken.length > 0 ? 'broken' : 'clues');
        expect(hint?.steps.at(-1)?.kind).toBe('result');
      }
    },
    SLOW,
  );

  it('names the people and the places it speaks about', () => {
    const record = records[0];
    if (record === undefined) {
      throw new Error('no level');
    }
    const level = toLevel(record);
    const steps = explain(
      level,
      level.people.map(() => undefined),
      0,
    );
    const text = explanationLines(steps, wordsOf(record, 0)).join(' ');
    expect(text).toContain(record.people[0]?.name ?? '?');
    expect(text).toContain('cell ');
  });
});
