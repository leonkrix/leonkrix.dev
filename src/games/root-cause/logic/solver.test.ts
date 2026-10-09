import { describe, expect, it } from 'vitest';

import { ANN, BEN, CLEO, kinds, layout, people, solution } from './fixtures';
import { solve } from './solver';
import { type Clue } from './types';

/** Clues that leave exactly one solution on the 4 by 4 fixture */
const unique: Clue[] = [
  { type: 'onKind', person: ANN, kind: 'chair' },
  { type: 'windowFront', person: BEN },
  { type: 'notInRoom', person: BEN, room: 0 },
  { type: 'line', person: CLEO, line: 'lastCol' },
  { type: 'nextToKind', person: CLEO, kind: 'chair' },
];

const puzzle = (clues: readonly Clue[]) => ({ layout, kinds, people, clues });

describe('solve', () => {
  it('finds the one solution of a unique puzzle, and it is the stored one', () => {
    const result = solve(puzzle(unique));
    expect(result.count).toBe(1);
    expect(result.solutions[0]).toEqual([...solution]);
    expect(result.complete).toBe(true);
  });

  it('finds more than one solution when a clue that is needed is missing', () => {
    // Take away every clue that can go, so that only the needed ones are left
    let needed: Clue[] = [...unique];
    for (const clue of unique) {
      const without = needed.filter((other) => other !== clue);
      if (solve(puzzle(without)).count === 1) {
        needed = without;
      }
    }
    expect(needed.length).toBeGreaterThan(0);
    expect(solve(puzzle(needed)).count).toBe(1);
    for (const clue of needed) {
      const without = needed.filter((other) => other !== clue);
      expect(solve(puzzle(without)).count, JSON.stringify(clue)).toBe(2);
    }
  });

  it('finds no solution when the clues contradict each other', () => {
    const clues: Clue[] = [...unique, { type: 'inRoom', person: BEN, room: 0 }];
    expect(solve(puzzle(clues)).count).toBe(0);
  });

  it('stops at the limit', () => {
    expect(solve(puzzle([]), { limit: 1 }).count).toBe(1);
    expect(solve(puzzle([]), { limit: 5 }).count).toBe(5);
  });

  it('never puts anybody on a cell that is blocked, and keeps one person in every row and column', () => {
    for (const found of solve(puzzle([]), { limit: 200 }).solutions) {
      expect(found).not.toContain(9);
      expect(new Set(found.map((cell) => Math.floor(cell / 4))).size).toBe(4);
      expect(new Set(found.map((cell) => cell % 4)).size).toBe(4);
    }
  });

  it('always keeps the rule about the victim: exactly one suspect shares the room', () => {
    for (const found of solve(puzzle([]), { limit: 200 }).solutions) {
      const victimRoom = layout.roomOf[found[3] ?? 0];
      const suspectsThere = found.slice(0, 3).filter((cell) => layout.roomOf[cell] === victimRoom);
      expect(suspectsThere).toHaveLength(1);
    }
  });

  it('says so when it had to give up', () => {
    const result = solve(puzzle([]), { limit: 1_000_000, maxNodes: 5 });
    expect(result.complete).toBe(false);
  });

  it('refuses a puzzle with the wrong number of people', () => {
    expect(() => solve({ layout, kinds, people: people.slice(0, 3), clues: [] })).toThrow(
      RangeError,
    );
  });
});
