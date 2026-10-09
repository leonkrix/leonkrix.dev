import { Board } from './board';
import { type Context } from './clues';
import { type KindInfo, type Layout, type Level, type Person } from './types';

/**
 * A small hand-made puzzle for the tests. The 4 by 4 board has two rooms (the left half and the
 * right half), a chair, a bed, a table that blocks its cell, and two windows:
 *
 *        col 0   col 1 | col 2   col 3        room 0 is the left half, room 1 the right half
 *  row 0  chair   .    |  .       .          (window on top of the chair)
 *  row 1   .      .   (window)    chair
 *  row 2   .     table |  .       .
 *  row 3   bed    bed  |  .       .
 *
 * Ann stands on the chair in the left room, Ben at (1,2), Cleo at (2,3) and the victim Vic at
 * (3,1) on the bed: Ann is alone with the victim, so she is the culprit.
 */
export const kinds: Readonly<Record<string, KindInfo>> = {
  chair: { occupiable: true },
  bed: { occupiable: true },
  table: { occupiable: false },
};

export const layout: Layout = {
  size: 4,
  roomOf: [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
  roomCount: 2,
  rooms: [
    { type: 'open-office', name: 'Open office' },
    { type: 'server-room', name: 'Server room' },
  ],
  objects: [
    { kind: 'chair', cells: [0] },
    { kind: 'chair', cells: [7] },
    { kind: 'table', cells: [9] },
    { kind: 'bed', cells: [12, 13] },
  ],
  windows: [
    { cell: 0, side: 'n' },
    { cell: 5, side: 'e' },
  ],
};

export const people: readonly Person[] = [
  { role: 'developer', name: 'Ann', label: 'A' },
  { role: 'designer', name: 'Ben', label: 'B' },
  { role: 'developer', name: 'Cleo', label: 'C' },
  { role: 'admin', name: 'Vic', label: 'V' },
];

/** Ann, Ben, Cleo and Vic */
export const solution: readonly number[] = [0, 6, 11, 13];

export const [ANN, BEN, CLEO, VIC] = [0, 1, 2, 3] as const;

export const board = new Board(layout, kinds);

export const context: Context = { board, people, victim: VIC };

export const level: Level = { layout, kinds, people, clues: [], solution };

/** The clue types that clues-more.test.ts covers (the first tests cover the others). */
export const MORE_CLUE_TYPES = [
  'inRoomType',
  'notInRoomType',
  'roomHasWindow',
  'roomHasKind',
  'roomSize',
  'onFurniture',
  'onFloor',
  'kindInLine',
  'relativeToKind',
  'and',
  'or',
  'emptyRooms',
  'kindCount',
  'kindFree',
  'distinctRoomCounts',
  'everyRoomKind',
  'noRoleNextToKind',
  'rolesApart',
  'separate',
  'cornerCount',
] as const;

/**
 * A second hand-made map for rooms of different sizes: a corridor of four cells along the top and
 * one big room below it, with a window above the first cell.
 */
export const uneven: Layout = {
  size: 4,
  roomOf: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  roomCount: 2,
  rooms: [
    { type: 'corridor', name: 'Corridor' },
    { type: 'open-office', name: 'Open office' },
  ],
  objects: [],
  windows: [{ cell: 0, side: 'n' }],
};

export const unevenBoard = new Board(uneven, kinds);

export const unevenContext: Context = { board: unevenBoard, people, victim: VIC };
