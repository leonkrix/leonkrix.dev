import { describe, expect, it } from 'vitest';

import {
  check,
  CLUE_TYPES,
  clueLevelOf,
  directionHolds,
  isNeutral,
  isStatic,
  mentions,
  subjectOf,
  UNPLACED,
} from './clues';
import {
  ANN,
  BEN,
  board,
  CLEO,
  context,
  MORE_CLUE_TYPES,
  solution,
  unevenContext,
} from './fixtures';
import { type Clue, type PersonClue } from './types';

/**
 * The fixture: Ann (0) on the chair in the open office, Ben (6) at a window and Cleo (11) in the
 * server room, Vic (13) on the bed in the open office. The chair at 7 and the table at 9 are empty
 * or blocked. Both rooms have eight cells.
 */
const trueClues: [string, Clue][] = [
  ['inRoomType', { type: 'inRoomType', person: ANN, roomType: 'open-office' }],
  ['notInRoomType', { type: 'notInRoomType', person: BEN, roomType: 'open-office' }],
  ['roomHasWindow', { type: 'roomHasWindow', person: ANN, has: true }],
  ['roomHasKind has', { type: 'roomHasKind', person: ANN, kind: 'bed', has: true }],
  ['roomHasKind has not', { type: 'roomHasKind', person: BEN, kind: 'bed', has: false }],
  ['onFurniture', { type: 'onFurniture', person: ANN }],
  ['onFloor', { type: 'onFloor', person: BEN }],
  [
    'kindInLine row',
    { type: 'kindInLine', person: BEN, kind: 'chair', axis: 'row', where: 'same' },
  ],
  [
    'kindInLine col',
    { type: 'kindInLine', person: CLEO, kind: 'chair', axis: 'col', where: 'same' },
  ],
  [
    'relativeToKind other room',
    { type: 'relativeToKind', person: CLEO, kind: 'chair', direction: 'southeast', where: 'other' },
  ],
  [
    'relativeToKind anywhere',
    { type: 'relativeToKind', person: BEN, kind: 'chair', direction: 'west', where: 'any' },
  ],
  [
    'direction northwest',
    { type: 'direction', person: BEN, other: CLEO, direction: 'northwest', mode: 'any' },
  ],
  [
    'direction diagonal step',
    { type: 'direction', person: BEN, other: CLEO, direction: 'northwest', mode: 'adjacent' },
  ],
  [
    'and',
    {
      type: 'and',
      person: ANN,
      parts: [
        { type: 'onKind', person: ANN, kind: 'chair' },
        { type: 'inRoom', person: ANN, room: 0 },
      ],
    },
  ],
  [
    'or with one part false',
    {
      type: 'or',
      person: ANN,
      parts: [
        { type: 'inRoom', person: ANN, room: 1 },
        { type: 'corner', person: ANN },
      ],
    },
  ],
  ['emptyRooms', { type: 'emptyRooms', n: 0 }],
  ['kindCount exactly', { type: 'kindCount', kind: 'chair', counting: 'exactly', n: 1 }],
  ['kindCount at least', { type: 'kindCount', kind: 'bed', counting: 'atLeast', n: 1 }],
  ['kindCount nobody', { type: 'kindCount', kind: 'table', counting: 'exactly', n: 0 }],
  ['kindFree', { type: 'kindFree', kind: 'chair', n: 1 }],
  ['everyRoomKind', { type: 'everyRoomKind', kind: 'table', n: 0 }],
  ['noRoleNextToKind', { type: 'noRoleNextToKind', role: 'developer', kind: 'table' }],
  ['rolesApart', { type: 'rolesApart' }],
  ['separate', { type: 'separate', persons: [ANN, BEN] }],
  ['cornerCount', { type: 'cornerCount', n: 1 }],
];

const falseClues: [string, Clue][] = [
  ['inRoomType', { type: 'inRoomType', person: ANN, roomType: 'server-room' }],
  ['notInRoomType', { type: 'notInRoomType', person: ANN, roomType: 'open-office' }],
  ['roomHasWindow', { type: 'roomHasWindow', person: ANN, has: false }],
  ['roomHasKind', { type: 'roomHasKind', person: BEN, kind: 'bed', has: true }],
  ['roomSize (a tie is no extreme)', { type: 'roomSize', person: ANN, which: 'largest' }],
  ['onFurniture', { type: 'onFurniture', person: BEN }],
  ['onFloor', { type: 'onFloor', person: ANN }],
  ['kindInLine', { type: 'kindInLine', person: CLEO, kind: 'chair', axis: 'col', where: 'other' }],
  [
    'relativeToKind',
    { type: 'relativeToKind', person: CLEO, kind: 'chair', direction: 'southeast', where: 'same' },
  ],
  [
    'direction northeast',
    { type: 'direction', person: BEN, other: CLEO, direction: 'northeast', mode: 'any' },
  ],
  [
    'and with one part false',
    {
      type: 'and',
      person: ANN,
      parts: [
        { type: 'onKind', person: ANN, kind: 'chair' },
        { type: 'inRoom', person: ANN, room: 1 },
      ],
    },
  ],
  [
    'or with both parts false',
    {
      type: 'or',
      person: ANN,
      parts: [
        { type: 'inRoom', person: ANN, room: 1 },
        { type: 'windowFront', person: CLEO },
      ],
    },
  ],
  ['emptyRooms', { type: 'emptyRooms', n: 1 }],
  ['kindCount', { type: 'kindCount', kind: 'chair', counting: 'exactly', n: 2 }],
  ['kindFree', { type: 'kindFree', kind: 'chair', n: 0 }],
  ['distinctRoomCounts', { type: 'distinctRoomCounts' }],
  ['everyRoomKind', { type: 'everyRoomKind', kind: 'chair', n: 1 }],
  ['noRoleNextToKind', { type: 'noRoleNextToKind', role: 'developer', kind: 'chair' }],
  ['separate', { type: 'separate', persons: [ANN, BEN, CLEO] }],
  ['cornerCount', { type: 'cornerCount', n: 0 }],
];

describe('the newer clues, true for the solution', () => {
  it.each(trueClues)('%s', (_name, clue) => {
    expect(check(clue, context, solution)).toBe(true);
  });
});

describe('the newer clues, false for the solution', () => {
  it.each(falseClues)('%s', (_name, clue) => {
    expect(check(clue, context, solution)).toBe(false);
  });

  it('together with the true ones they cover every newer type', () => {
    const covered = new Set([...trueClues, ...falseClues].map(([, clue]) => clue.type));
    expect(MORE_CLUE_TYPES.filter((type) => !covered.has(type))).toEqual([]);
    expect(CLUE_TYPES.length).toBeGreaterThan(MORE_CLUE_TYPES.length);
  });
});

describe('rooms of different sizes', () => {
  // Ann alone in the corridor of four cells, the other three in the big room of twelve
  const placement = [0, 6, 11, 13];

  it('knows the smallest and the largest room when there is one of each', () => {
    expect(
      check({ type: 'roomSize', person: ANN, which: 'smallest' }, unevenContext, placement),
    ).toBe(true);
    expect(
      check({ type: 'roomSize', person: BEN, which: 'largest' }, unevenContext, placement),
    ).toBe(true);
    expect(
      check({ type: 'roomSize', person: BEN, which: 'smallest' }, unevenContext, placement),
    ).toBe(false);
  });

  it('counts the people of the rooms: all different, or not', () => {
    expect(check({ type: 'distinctRoomCounts' }, unevenContext, placement)).toBe(true);
    expect(check({ type: 'distinctRoomCounts' }, unevenContext, [0, 4, 11, 13])).toBe(true);
    expect(check({ type: 'distinctRoomCounts' }, unevenContext, [0, 1, 11, 13])).toBe(false);
  });

  it('knows an empty room', () => {
    expect(check({ type: 'emptyRooms', n: 1 }, unevenContext, [4, 6, 11, 13])).toBe(true);
    expect(check({ type: 'emptyRooms', n: 0 }, unevenContext, [4, 6, 11, 13])).toBe(false);
  });

  it('puts a window in the corridor and not elsewhere', () => {
    expect(check({ type: 'roomHasWindow', person: ANN, has: true }, unevenContext, placement)).toBe(
      true,
    );
    expect(check({ type: 'roomHasWindow', person: BEN, has: true }, unevenContext, placement)).toBe(
      false,
    );
  });
});

describe('the newer clues on an incomplete placement', () => {
  it('cannot say yet where a person is missing', () => {
    expect(
      check({ type: 'onFurniture', person: ANN }, context, [UNPLACED, 6, 11, 13]),
    ).toBeUndefined();
    const and: Clue = {
      type: 'and',
      person: ANN,
      parts: [
        { type: 'onKind', person: ANN, kind: 'chair' },
        { type: 'sameRoom', person: ANN, other: BEN },
      ],
    };
    // One part is already false (Ann is on the chair, but Ben is not placed): and is false as soon
    // as one part is false, and not decided while the other part is open
    expect(check(and, context, [0, UNPLACED, 11, 13])).toBeUndefined();
    expect(check(and, context, [4, UNPLACED, 11, 13])).toBe(false);
  });

  it('an or is true as soon as one part is true, false only when both parts are false', () => {
    const or: Clue = {
      type: 'or',
      person: ANN,
      parts: [
        { type: 'corner', person: ANN },
        { type: 'sameRoom', person: ANN, other: BEN },
      ],
    };
    expect(check(or, context, [0, UNPLACED, 11, 13])).toBe(true);
    expect(check(or, context, [4, UNPLACED, 11, 13])).toBeUndefined();
    expect(check(or, context, [4, 6, 11, 13])).toBe(false);
  });

  it('counts people on a kind of object with bounds', () => {
    const atLeastTwo: Clue = { type: 'kindCount', kind: 'chair', counting: 'atLeast', n: 2 };
    expect(check(atLeastTwo, context, [0, 7, 11, 13])).toBe(true);
    expect(check(atLeastTwo, context, [0, UNPLACED, UNPLACED, 13])).toBeUndefined();
    expect(check(atLeastTwo, context, [0, 6, 11, 13])).toBe(false);
    const nobody: Clue = { type: 'kindCount', kind: 'chair', counting: 'exactly', n: 0 };
    expect(check(nobody, context, [0, UNPLACED, UNPLACED, UNPLACED])).toBe(false);
    expect(check(nobody, context, [4, UNPLACED, UNPLACED, UNPLACED])).toBeUndefined();
  });

  it('tells that two suspects share a room as soon as both are placed', () => {
    const apart: Clue = { type: 'separate', persons: [BEN, CLEO] };
    expect(check(apart, context, [UNPLACED, 6, UNPLACED, UNPLACED])).toBeUndefined();
    expect(check(apart, context, [UNPLACED, 6, 11, UNPLACED])).toBe(false);
  });
});

describe('directions', () => {
  it('knows the eight directions, in any distance and one step away', () => {
    // The cells: (1,1) is 5, (0,2) is 2, (2,0) is 8, (2,2) is 10, (0,0) is 0
    expect(directionHolds(board, 2, 5, 'northeast', 'adjacent')).toBe(true);
    expect(directionHolds(board, 0, 5, 'northwest', 'adjacent')).toBe(true);
    expect(directionHolds(board, 8, 5, 'southwest', 'adjacent')).toBe(true);
    expect(directionHolds(board, 10, 5, 'southeast', 'adjacent')).toBe(true);
    expect(directionHolds(board, 0, 10, 'northwest', 'any')).toBe(true);
    expect(directionHolds(board, 0, 10, 'north', 'adjacent')).toBe(false);
    expect(directionHolds(board, 3, 12, 'northeast', 'any')).toBe(true);
    expect(directionHolds(board, 12, 3, 'northeast', 'any')).toBe(false);
  });
});

describe('levels and numbers of the newer clues', () => {
  it('rates a combination as hard as its harder part, at least medium, and an or as hard', () => {
    const easy: PersonClue = { type: 'corner', person: 0 };
    const hard: PersonClue = { type: 'distance', person: 0, other: 1, distance: 2 };
    expect(
      clueLevelOf({ type: 'and', person: 0, parts: [easy, { type: 'windowFront', person: 0 }] }),
    ).toBe(2);
    expect(clueLevelOf({ type: 'and', person: 0, parts: [easy, hard] })).toBe(3);
    expect(clueLevelOf({ type: 'or', person: 0, parts: [easy, easy] })).toBe(3);
  });

  it('rates counting clues by their numbers', () => {
    expect(clueLevelOf({ type: 'kindCount', kind: 'chair', counting: 'exactly', n: 0 })).toBe(1);
    expect(clueLevelOf({ type: 'kindCount', kind: 'chair', counting: 'atLeast', n: 1 })).toBe(2);
    expect(clueLevelOf({ type: 'emptyRooms', n: 0 })).toBe(2);
    expect(clueLevelOf({ type: 'emptyRooms', n: 2 })).toBe(3);
  });

  it('knows which clues are about the whole map, and whom the others mention', () => {
    expect(isNeutral({ type: 'rolesApart' })).toBe(true);
    expect(isNeutral({ type: 'corner', person: 1 })).toBe(false);
    expect(subjectOf({ type: 'kindFree', kind: 'chair', n: 1 })).toBeUndefined();
    expect(mentions({ type: 'separate', persons: [0, 1, 2] })).toEqual([0, 1, 2]);
    const combined: Clue = {
      type: 'and',
      person: 1,
      parts: [
        { type: 'corner', person: 1 },
        { type: 'sameRoom', person: 1, other: 0 },
      ],
    };
    expect([...mentions(combined)].sort()).toEqual([0, 1]);
    expect(subjectOf(combined)).toBe(1);
  });

  it('tells the clues that only depend on the cell of one person', () => {
    expect(isStatic({ type: 'inRoomType', person: 0, roomType: 'lab' })).toBe(true);
    expect(isStatic({ type: 'sameRoom', person: 0, other: 1 })).toBe(false);
    expect(isStatic({ type: 'alone', person: 0 })).toBe(false);
    expect(isStatic({ type: 'rolesApart' })).toBe(false);
    expect(
      isStatic({
        type: 'and',
        person: 0,
        parts: [
          { type: 'corner', person: 0 },
          { type: 'onFloor', person: 0 },
        ],
      }),
    ).toBe(true);
    expect(
      isStatic({
        type: 'or',
        person: 0,
        parts: [
          { type: 'corner', person: 0 },
          { type: 'sameRoom', person: 0, other: 1 },
        ],
      }),
    ).toBe(false);
  });
});
