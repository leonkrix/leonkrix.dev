import { describe, expect, it } from 'vitest';

import { Board } from './board';
import { check, type Context, UNPLACED } from './clues';
import { ANN, context, layout } from './fixtures';
import { type Clue, type Layout } from './types';

/**
 * The bed of the fixture covers two cells (12 and 13, the bottom row of the left room). An object
 * is one unit, also when it covers two cells: standing on one half does not make a person "next
 * to" the bed because the other half is beside them, and a direction is taken from the whole bed.
 */
const holds = (clue: Clue, cell: number): boolean | undefined =>
  check(
    clue,
    context,
    context.people.map((_, person) => (person === ANN ? cell : UNPLACED)),
  );

describe('next to an object that covers two cells', () => {
  const next: Clue = { type: 'nextToKind', person: ANN, kind: 'bed' };
  const notNext: Clue = { type: 'notNextToKind', person: ANN, kind: 'bed' };

  it('is true beside the bed, and false on it', () => {
    expect(holds(next, 8)).toBe(true); // above the left half
    expect(holds(next, 9)).toBe(true); // above the right half
    expect(holds(next, 12)).toBe(false); // on the left half: the right half is beside, but it is the same bed
    expect(holds(next, 13)).toBe(false);
  });

  it('is the other way round for "not next to"', () => {
    expect(holds(notNext, 12)).toBe(true);
    expect(holds(notNext, 8)).toBe(false);
  });

  it('still counts another object of the same kind that is beside a person on one', () => {
    // The chairs of the fixture are single cells: a person beside a chair is next to it
    expect(holds({ type: 'nextToKind', person: ANN, kind: 'chair' }, 1)).toBe(true);
    // and a person on the chair is not next to that chair
    expect(holds({ type: 'nextToKind', person: ANN, kind: 'chair' }, 0)).toBe(false);
  });
});

describe('a direction from an object that covers two cells', () => {
  const east: Clue = {
    type: 'relativeToKind',
    person: ANN,
    kind: 'bed',
    direction: 'east',
    where: 'any',
  };
  const north: Clue = { ...east, direction: 'north' };

  it('is taken from the whole object: east of the bed is east of its right half', () => {
    expect(holds(east, 5)).toBe(false); // east of the left half only (column 1 against columns 0 and 1)
    expect(holds(east, 6)).toBe(true);
  });

  it('is north of the top cell, and never on the bed itself', () => {
    expect(holds(north, 8)).toBe(true);
    expect(holds(north, 12)).toBe(false);
    expect(holds(north, 13)).toBe(false);
  });
});

describe('the same row or column as a sofa that covers two cells', () => {
  // A vertical sofa on cells 5 and 9 (column 1, rows 1 and 2) and a horizontal one on 12 and 13
  // (row 3, columns 0 and 1), all in the left room
  const sofaLayout: Layout = {
    ...layout,
    objects: [
      { kind: 'sofa', cells: [5, 9] },
      { kind: 'sofa', cells: [12, 13] },
    ],
    windows: [],
  };
  const sofaBoard = new Board(sofaLayout, { sofa: { occupiable: true } });
  const sofaContext: Context = { ...context, board: sofaBoard };
  const inLine = (axis: 'row' | 'col', cell: number): boolean | undefined =>
    check(
      { type: 'kindInLine', person: ANN, kind: 'sofa', axis, where: 'same' },
      sofaContext,
      context.people.map((_, person) => (person === ANN ? cell : UNPLACED)),
    );

  it('counts both rows of a vertical sofa, and both columns of a horizontal one', () => {
    // Cell 4 is in row 1 and cell 8 in row 2: each is in the row of one half of the vertical sofa
    expect(inLine('row', 4)).toBe(true);
    expect(inLine('row', 8)).toBe(true);
    // Row 0 has no sofa
    expect(inLine('row', 1)).toBe(false);
    // Cells 0 and 1 are in the columns of the two halves of the horizontal sofa (columns 0 and 1)
    expect(inLine('col', 0)).toBe(true);
    expect(inLine('col', 4)).toBe(true);
  });

  it('counts the object a person sits on too: it lies in the row or column of the person', () => {
    // On the top half of the vertical sofa (cell 5): the sofa lies in column 1 and in row 1
    expect(inLine('col', 5)).toBe(true);
    expect(inLine('row', 5)).toBe(true);
    // On the right half of the horizontal sofa (cell 13): the sofa lies in row 3
    expect(inLine('row', 13)).toBe(true);
    // and on the bottom half of the vertical sofa (cell 9) in row 2
    expect(inLine('row', 9)).toBe(true);
  });

  it('does the same for an object of one cell', () => {
    // A chair is in its own row: a person on it is in the same row as a chair
    expect(
      check(
        { type: 'kindInLine', person: ANN, kind: 'chair', axis: 'row', where: 'same' },
        context,
        context.people.map((_, person) => (person === ANN ? 0 : UNPLACED)),
      ),
    ).toBe(true);
  });
});
