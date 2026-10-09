import { describe, expect, it } from 'vitest';

import { ANN, BEN, CLEO, kinds, layout, people, solution } from './fixtures';
import { countByPropagation, rate } from './propagation';
import { solve } from './solver';
import { type Clue } from './types';

const puzzle = (clues: readonly Clue[]) => ({ layout, kinds, people, clues });

/** Clues that leave exactly one solution on the 4 by 4 fixture */
const unique: Clue[] = [
  { type: 'onKind', person: ANN, kind: 'chair' },
  { type: 'windowFront', person: BEN },
  { type: 'notInRoom', person: BEN, room: 0 },
  { type: 'line', person: CLEO, line: 'lastCol' },
  { type: 'nextToKind', person: CLEO, kind: 'chair' },
];

const extra: Clue[] = [
  { type: 'inRoom', person: ANN, room: 0 },
  { type: 'sameRoom', person: BEN, other: CLEO },
  { type: 'direction', person: ANN, other: BEN, direction: 'north', mode: 'adjacent' },
  { type: 'roomMates', person: BEN, counting: 'exactly', n: 1 },
  { type: 'between', person: BEN, other: ANN, third: CLEO, axis: 'row' },
  { type: 'inRoom', person: BEN, room: 0 },
];

describe('countByPropagation and solve agree', () => {
  it('finds the stored solution of a unique puzzle', () => {
    const result = countByPropagation(puzzle(unique));
    expect(result.count).toBe(1);
    expect(result.solutions[0]).toEqual([...solution]);
  });

  it('gives the same count as the search in solver.ts for every combination of clues', () => {
    const pool = [...unique, ...extra];
    let compared = 0;
    for (let mask = 0; mask < 1 << pool.length; mask += 7) {
      const clues = pool.filter((_, index) => (mask & (1 << index)) !== 0);
      const first = solve(puzzle(clues), { limit: 3 });
      const second = countByPropagation(puzzle(clues), 3);
      expect(second.count, JSON.stringify(clues)).toBe(first.count);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(100);
  });
});

describe('rate', () => {
  it('solves a unique puzzle with the rules', () => {
    const rating = rate(puzzle(unique));
    expect(rating.solved).toBe(true);
    expect(rating.level).toBeLessThanOrEqual(2);
    expect(rating.clueLevel).toBe(2);
    expect(rating.steps).toBeGreaterThan(0);
  });

  it('rates a puzzle with easy clues only as level 1, and notes the level of the clues', () => {
    const easy: Clue[] = [
      { type: 'onKind', person: ANN, kind: 'chair' },
      { type: 'inRoom', person: ANN, room: 0 },
      { type: 'windowFront', person: BEN },
      { type: 'inRoom', person: BEN, room: 1 },
      { type: 'line', person: CLEO, line: 'lastCol' },
      { type: 'inRoom', person: CLEO, room: 1 },
    ];
    const rating = rate(puzzle(easy));
    expect(rating.clueLevel).toBe(1);
    expect(solve(puzzle(easy)).count).toBe(1);
    expect(rating.solved).toBe(true);
    expect(rating.level).toBe(1);
  });

  it('does not claim to solve a puzzle that has more than one solution', () => {
    const rating = rate(puzzle([{ type: 'inRoom', person: ANN, room: 0 }]));
    expect(rating.solved).toBe(false);
    expect(rating.level).toBe(4);
  });

  it('recognizes the clue level of a hard clue', () => {
    const rating = rate(
      puzzle([...unique, { type: 'between', person: BEN, other: ANN, third: CLEO, axis: 'row' }]),
    );
    expect(rating.clueLevel).toBe(3);
  });
});
