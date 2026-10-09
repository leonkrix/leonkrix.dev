import { describe, expect, it } from 'vitest';

import { Board } from './board';
import {
  check,
  checkVictimRule,
  CLUE_LEVEL,
  CLUE_TYPES,
  isSolution,
  mentions,
  subjectOf,
  UNPLACED,
} from './clues';
import { ANN, BEN, board, CLEO, context, MORE_CLUE_TYPES, solution, VIC } from './fixtures';
import { type Clue } from './types';

const full = solution;

/** Ann, Ben, Cleo and Vic placed; `partial` leaves the given people unplaced */
function withUnplaced(...people: number[]): number[] {
  return solution.map((cell, person) => (people.includes(person) ? UNPLACED : cell));
}

describe('the board of the fixture', () => {
  it('knows its walls, windows and neighbors', () => {
    expect([...board.windowCells].sort((a, b) => a - b)).toEqual([0, 5, 6]);
    expect(board.blocked.has(9)).toBe(true);
    expect(board.blocked.has(0)).toBe(false);
    // Cell 5 touches the room boundary on its right, cell 4 only the left room's own cells
    expect(board.wallCells.has(5)).toBe(true);
    expect(board.wallCells.has(4)).toBe(true);
    expect(board.wallCells.has(9)).toBe(true);
    // Neighbors never cross a room boundary
    expect(board.roomNeighbors[5]).toEqual([1, 9, 4]);
    expect(board.roomNeighbors[6]).toEqual([2, 7, 10]);
  });
});

describe('clues that are true for the solution', () => {
  const trueClues: [string, Clue][] = [
    ['inRoom', { type: 'inRoom', person: ANN, room: 0 }],
    ['notInRoom', { type: 'notInRoom', person: BEN, room: 0 }],
    ['sameRoom', { type: 'sameRoom', person: BEN, other: CLEO }],
    ['notSameRoom', { type: 'notSameRoom', person: ANN, other: BEN }],
    ['onKind', { type: 'onKind', person: ANN, kind: 'chair' }],
    ['notOnKind', { type: 'notOnKind', person: BEN, kind: 'chair' }],
    ['soleOnKind', { type: 'soleOnKind', person: ANN, kind: 'chair' }],
    ['nextToKind', { type: 'nextToKind', person: CLEO, kind: 'chair' }],
    ['notNextToKind', { type: 'notNextToKind', person: BEN, kind: 'table' }],
    ['windowFront', { type: 'windowFront', person: BEN }],
    ['corner', { type: 'corner', person: ANN }],
    ['line', { type: 'line', person: ANN, line: 'firstRow' }],
    ['nextToWall', { type: 'nextToWall', person: CLEO }],
    ['roomMates', { type: 'roomMates', person: BEN, counting: 'exactly', n: 1 }],
    ['roomMates at least', { type: 'roomMates', person: BEN, counting: 'atLeast', n: 1 }],
    ['roomRole', { type: 'roomRole', person: BEN, role: 'developer', counting: 'exactly', n: 1 }],
    ['roomRole none', { type: 'roomRole', person: ANN, role: 'designer', counting: 'none', n: 0 }],
    [
      'direction adjacent',
      { type: 'direction', person: ANN, other: BEN, direction: 'north', mode: 'adjacent' },
    ],
    [
      'direction any',
      { type: 'direction', person: CLEO, other: ANN, direction: 'south', mode: 'any' },
    ],
    [
      'direction east',
      { type: 'direction', person: CLEO, other: BEN, direction: 'east', mode: 'adjacent' },
    ],
    [
      'direction west',
      { type: 'direction', person: BEN, other: CLEO, direction: 'west', mode: 'adjacent' },
    ],
    ['diagonal', { type: 'diagonal', person: BEN, other: CLEO }],
    ['between', { type: 'between', person: BEN, other: ANN, third: CLEO, axis: 'row' }],
    ['between columns', { type: 'between', person: BEN, other: ANN, third: CLEO, axis: 'col' }],
    ['distance', { type: 'distance', person: BEN, other: CLEO, distance: 2 }],
    ['roomEmpty', { type: 'roomEmpty', room: 2 }],
    ['roomCount', { type: 'roomCount', room: 1, n: 2 }],
  ];

  it.each(trueClues)('%s', (_name, clue) => {
    expect(check(clue, context, full)).toBe(true);
  });

  it('shows every clue type at least once, here or in the extra cases below', () => {
    // roomEmpty needs a room without people, which the fixture does not have: it is tested below
    const covered = new Set(trueClues.map(([, clue]) => clue.type));
    covered.add('alone');
    covered.add('notNextToWall');
    // The newer clue types are tested in clues-more.test.ts
    for (const type of MORE_CLUE_TYPES) {
      covered.add(type);
    }
    expect(CLUE_TYPES.filter((type) => !covered.has(type))).toEqual([]);
  });
});

describe('clues that are false for the solution', () => {
  const falseClues: [string, Clue][] = [
    ['inRoom', { type: 'inRoom', person: ANN, room: 1 }],
    ['notInRoom', { type: 'notInRoom', person: ANN, room: 0 }],
    ['sameRoom', { type: 'sameRoom', person: ANN, other: BEN }],
    ['notSameRoom', { type: 'notSameRoom', person: BEN, other: CLEO }],
    ['onKind', { type: 'onKind', person: BEN, kind: 'chair' }],
    ['notOnKind', { type: 'notOnKind', person: ANN, kind: 'chair' }],
    ['soleOnKind (not on it)', { type: 'soleOnKind', person: BEN, kind: 'chair' }],
    ['nextToKind', { type: 'nextToKind', person: ANN, kind: 'table' }],
    ['notNextToKind', { type: 'notNextToKind', person: CLEO, kind: 'chair' }],
    ['windowFront', { type: 'windowFront', person: CLEO }],
    ['corner', { type: 'corner', person: BEN }],
    ['line', { type: 'line', person: ANN, line: 'lastRow' }],
    ['notNextToWall', { type: 'notNextToWall', person: ANN }],
    ['alone', { type: 'alone', person: BEN }],
    ['roomMates', { type: 'roomMates', person: BEN, counting: 'exactly', n: 2 }],
    ['roomRole', { type: 'roomRole', person: BEN, role: 'developer', counting: 'none', n: 0 }],
    [
      'direction adjacent',
      { type: 'direction', person: ANN, other: CLEO, direction: 'north', mode: 'adjacent' },
    ],
    [
      'direction any',
      { type: 'direction', person: ANN, other: BEN, direction: 'south', mode: 'any' },
    ],
    ['diagonal', { type: 'diagonal', person: ANN, other: CLEO }],
    ['between', { type: 'between', person: ANN, other: BEN, third: CLEO, axis: 'row' }],
    ['distance', { type: 'distance', person: BEN, other: CLEO, distance: 3 }],
    ['roomEmpty', { type: 'roomEmpty', room: 0 }],
    ['roomCount', { type: 'roomCount', room: 1, n: 3 }],
  ];

  it.each(falseClues)('%s', (_name, clue) => {
    expect(check(clue, context, full)).toBe(false);
  });
});

describe('clues on a placement that is not complete', () => {
  it('cannot say anything while the person is not placed', () => {
    expect(
      check({ type: 'inRoom', person: ANN, room: 0 }, context, withUnplaced(ANN)),
    ).toBeUndefined();
    expect(
      check({ type: 'corner', person: ANN }, context, [UNPLACED, UNPLACED, UNPLACED, UNPLACED]),
    ).toBeUndefined();
  });

  it('cannot say anything about another person who is not placed', () => {
    const clue: Clue = { type: 'sameRoom', person: BEN, other: CLEO };
    expect(check(clue, context, withUnplaced(CLEO))).toBeUndefined();
    const between: Clue = { type: 'between', person: BEN, other: ANN, third: CLEO, axis: 'row' };
    expect(check(between, context, withUnplaced(CLEO))).toBeUndefined();
  });

  it('can already say no when somebody else is in the room', () => {
    // Ann is alone only if nobody else is in her room: Vic in her room, and Ben placed there too
    const alone: Clue = { type: 'alone', person: ANN };
    expect(check(alone, context, [0, UNPLACED, UNPLACED, 13])).toBe(false);
    expect(check(alone, context, [0, 6, 11, UNPLACED])).toBeUndefined();
    expect(check(alone, context, [0, 6, 11, 13])).toBe(false);
  });

  it('counts the people who are placed and the ones who could still arrive', () => {
    const atLeastTwo: Clue = { type: 'roomMates', person: BEN, counting: 'atLeast', n: 2 };
    // Ben's room has Cleo already; Ann and Vic are open and could join
    expect(check(atLeastTwo, context, [UNPLACED, 6, 11, UNPLACED])).toBeUndefined();
    // Nobody can join any more, so it is false
    expect(check(atLeastTwo, context, [0, 6, 11, 13])).toBe(false);
    const exactlyOne: Clue = { type: 'roomMates', person: BEN, counting: 'exactly', n: 1 };
    // Two others are already in the room
    expect(check(exactlyOne, context, [7, 6, 11, UNPLACED])).toBe(false);
  });

  it('knows a room that nobody is in', () => {
    // A room number that does not exist is empty: nobody can be in it
    expect(check({ type: 'roomEmpty', room: 5 }, context, full)).toBe(true);
    expect(check({ type: 'roomEmpty', room: 1 }, context, [UNPLACED, 6, UNPLACED, UNPLACED])).toBe(
      false,
    );
  });

  it('tells a person who is not alone on a kind of object', () => {
    const sole: Clue = { type: 'soleOnKind', person: ANN, kind: 'chair' };
    // Ben on the other chair (cell 7) means Ann is not the only one on a chair
    expect(check(sole, context, [0, 7, 11, 13])).toBe(false);
    expect(check(sole, context, [0, UNPLACED, 11, 13])).toBeUndefined();
  });
});

describe('the rule about the victim', () => {
  it('holds when exactly one suspect shares the room with the victim', () => {
    expect(checkVictimRule(context, full)).toBe(true);
  });

  it('fails with no suspect or with two suspects in the room of the victim', () => {
    expect(checkVictimRule(context, [2, 6, 11, 13])).toBe(false);
    expect(checkVictimRule(context, [0, 4, 11, 13])).toBe(false);
  });

  it('waits until the victim is placed', () => {
    expect(checkVictimRule(context, withUnplaced(VIC))).toBeUndefined();
  });

  it('is part of what makes a placement a solution', () => {
    expect(isSolution([], context, full)).toBe(true);
    expect(isSolution([{ type: 'corner', person: BEN }], context, full)).toBe(false);
    expect(isSolution([], context, [2, 6, 11, 13])).toBe(false);
  });
});

describe('clue metadata', () => {
  it('gives every clue type a level of 1 to 3', () => {
    for (const type of CLUE_TYPES) {
      expect([1, 2, 3], type).toContain(CLUE_LEVEL[type]);
    }
  });

  it('knows who a clue is about and whom it mentions', () => {
    const between: Clue = { type: 'between', person: 1, other: 0, third: 2, axis: 'row' };
    expect(mentions(between)).toEqual([1, 0, 2]);
    expect(subjectOf(between)).toBe(1);
    const room: Clue = { type: 'roomCount', room: 0, n: 2 };
    expect(mentions(room)).toEqual([]);
    expect(subjectOf(room)).toBeUndefined();
    expect(mentions({ type: 'corner', person: 3 })).toEqual([3]);
  });
});

describe('clues that the fixture cannot show as true', () => {
  it('alone: nobody else is in the room', () => {
    // Ben is the only one in the right room
    expect(check({ type: 'alone', person: BEN }, context, [0, 6, 8, 13])).toBe(true);
  });

  it('notNextToWall: a cell in the middle of a room has no wall', () => {
    const middle = new Board(
      {
        size: 3,
        roomOf: Array.from({ length: 9 }, () => 0),
        roomCount: 1,
        rooms: [{ type: 'open-office', name: 'Open office' }],
        objects: [],
        windows: [],
      },
      {},
    );
    const small = { board: middle, people: context.people.slice(0, 3), victim: 2 };
    expect(check({ type: 'notNextToWall', person: 0 }, small, [4, 0, 8])).toBe(true);
    expect(check({ type: 'notNextToWall', person: 0 }, small, [0, 4, 8])).toBe(false);
  });
});
