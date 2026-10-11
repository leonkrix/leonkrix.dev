import { describe, expect, it } from 'vitest';

import { type LevelRecord } from '../pool';
import { chooseBalanced, clueKindsOf, imbalance } from './balance';
import { type Clue } from './types';

const clue = (type: string): Clue => ({ type, person: 0 }) as unknown as Clue;
const level = (...types: string[]): LevelRecord => ({ clues: types.map(clue) }) as LevelRecord;

describe('the kinds of clue of a level', () => {
  it('counts the parts of a combination as clues of their own', () => {
    const combo: Clue = {
      type: 'and',
      person: 0,
      parts: [
        { type: 'corner', person: 0 },
        { type: 'nextToWall', person: 0 },
      ],
    };
    expect(clueKindsOf([combo, clue('line')])).toEqual(['and', 'corner', 'nextToWall', 'line']);
  });
});

describe('how uneven a set of levels is', () => {
  it('is smaller when the kinds are spread out, and larger when a kind repeats', () => {
    const spread = imbalance([level('a', 'b'), level('c', 'd')]);
    const repeated = imbalance([level('a', 'a'), level('a', 'a')]);
    const sameInOneLevel = imbalance([level('a', 'a'), level('b', 'c')]);
    expect(spread).toBeLessThan(sameInOneLevel);
    expect(sameInOneLevel).toBeLessThan(repeated);
  });
});

describe('choosing levels for an even mix', () => {
  it('takes the candidates that repeat the least, and does the same for the same input', () => {
    const candidates = new Map<string, LevelRecord[]>([
      ['one', [level('a', 'a'), level('a', 'b'), level('b', 'c')]],
      ['two', [level('a', 'a'), level('a', 'c'), level('c', 'd')]],
    ]);
    const chosen = chooseBalanced(candidates);
    // The first candidates repeat everything; the chosen set uses more kinds and repeats less
    const kinds = [...chosen.values()].flatMap((entry) => clueKindsOf(entry.clues));
    expect(new Set(kinds).size).toBeGreaterThanOrEqual(3);
    expect(imbalance([...chosen.values()])).toBeLessThan(
      imbalance([level('a', 'a'), level('a', 'a')]),
    );
    expect([...chooseBalanced(candidates).values()]).toEqual([...chosen.values()]);
  });

  it('refuses an id without a candidate', () => {
    expect(() => chooseBalanced(new Map([['one', []]]))).toThrow(RangeError);
  });
});
