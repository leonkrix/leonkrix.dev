import { type Board } from './board';
import { type Cell, type Level } from './types';

/**
 * What the player has put on the map: where each person stands, which cells the player crossed out
 * (nobody is there) and the notes (small marks of the people who could still stand in a cell).
 * Nothing here knows about the interface, and nothing is changed in place: every action gives a
 * new value.
 *
 * Two things follow from what is placed, and are worked out from it instead of being stored, so
 * that taking a person off the map brings everything back exactly as it was: the cells in the row
 * and column of a person are crossed out (`autoCrossed`), and notes in a cell that is crossed out
 * or occupied, and notes about a person who is placed, are not shown (`visibleNotes`) but are
 * kept.
 */
export interface Play {
  /** The cell of every person (same order as `Level.people`), or nothing while not placed */
  readonly placed: readonly (Cell | undefined)[];
  /** The cells the player crossed out. Crosses that follow from a placement are not in here. */
  readonly crossed: readonly boolean[];
  /** For every cell, the people noted there, in order */
  readonly notes: readonly (readonly number[])[];
}

export function emptyPlay(level: Level): Play {
  const cells = level.layout.size * level.layout.size;
  return {
    placed: Array.from({ length: level.people.length }, () => undefined),
    crossed: Array.from({ length: cells }, () => false),
    notes: Array.from({ length: cells }, () => []),
  };
}

/** The person who stands on a cell, if any */
export function occupantOf(play: Play, cell: Cell): number | undefined {
  const person = play.placed.findIndex((placedCell) => placedCell === cell);
  return person === -1 ? undefined : person;
}

/**
 * The cells that are crossed out because somebody stands in their row or column (the cell of the
 * person itself and the cells of other people are not among them).
 */
export function autoCrossed(play: Play, board: Board): ReadonlySet<Cell> {
  const result = new Set<Cell>();
  for (const cell of play.placed) {
    if (cell === undefined) {
      continue;
    }
    for (let index = 0; index < board.size; index += 1) {
      result.add(board.cellAt(board.row(cell), index));
      result.add(board.cellAt(index, board.col(cell)));
    }
  }
  for (const cell of play.placed) {
    if (cell !== undefined) {
      result.delete(cell);
    }
  }
  return result;
}

/** Whether a cell shows a cross: the player crossed it out, or a placement crosses it out */
export function isCrossedOut(play: Play, auto: ReadonlySet<Cell>, cell: Cell): boolean {
  return play.crossed[cell] === true || auto.has(cell);
}

/**
 * The notes of a cell as the player sees them: none in a crossed out or occupied cell, and none
 * about a person who is placed (the placement says where that person is).
 */
export function visibleNotes(play: Play, auto: ReadonlySet<Cell>, cell: Cell): readonly number[] {
  if (occupantOf(play, cell) !== undefined || isCrossedOut(play, auto, cell)) {
    return [];
  }
  return (play.notes[cell] ?? []).filter((person) => play.placed[person] === undefined);
}

function withCell<T>(list: readonly T[], cell: Cell, value: T): T[] {
  return list.map((entry, index) => (index === cell ? value : entry));
}

/**
 * Puts a person on a cell. A person who stands there already is taken off again (so the same
 * click places and removes). Somebody else who stands there is replaced, and the person leaves
 * the old cell. Cells that nobody can stand on do nothing, and neither do cells that another
 * person crosses out (the cell is in the row or column of somebody else); a cross of the player
 * does not stop anybody. A cross and notes in the cell stay where they are, hidden under the
 * person, and are there again when the person leaves.
 */
export function placePerson(play: Play, board: Board, person: number, cell: Cell): Play {
  if (board.blocked.has(cell) || person < 0 || person >= play.placed.length) {
    return play;
  }
  if (play.placed[person] === cell) {
    return { ...play, placed: play.placed.map((c, index) => (index === person ? undefined : c)) };
  }
  // Somebody else in the row or column (the one who stands on the cell is replaced, so he does not count)
  const crossedByAnother = play.placed.some(
    (other, index) =>
      index !== person &&
      other !== undefined &&
      other !== cell &&
      (board.row(other) === board.row(cell) || board.col(other) === board.col(cell)),
  );
  if (crossedByAnother) {
    return play;
  }
  const placed = play.placed.map((c, index) => {
    if (index === person) {
      return cell;
    }
    return c === cell ? undefined : c;
  });
  return { ...play, placed };
}

/** Takes whoever stands on a cell off the map. */
export function removeFrom(play: Play, cell: Cell): Play {
  if (occupantOf(play, cell) === undefined) {
    return play;
  }
  return { ...play, placed: play.placed.map((c) => (c === cell ? undefined : c)) };
}

/**
 * Crosses a cell out, or takes the player's cross away. Nothing happens on a blocked or an
 * occupied cell, and a cell that a placement crosses out cannot be changed until the person leaves.
 */
export function toggleCross(play: Play, board: Board, cell: Cell): Play {
  if (board.blocked.has(cell) || occupantOf(play, cell) !== undefined) {
    return play;
  }
  if (!play.crossed[cell] && autoCrossed(play, board).has(cell)) {
    return play;
  }
  return { ...play, crossed: withCell(play.crossed, cell, !play.crossed[cell]) };
}

/** Notes that a person could stand in a cell, or takes the note away. */
export function toggleNote(play: Play, board: Board, cell: Cell, person: number): Play {
  if (
    play.placed[person] !== undefined ||
    board.blocked.has(cell) ||
    occupantOf(play, cell) !== undefined ||
    isCrossedOut(play, autoCrossed(play, board), cell)
  ) {
    return play;
  }
  const noted = play.notes[cell] ?? [];
  const next = noted.includes(person)
    ? noted.filter((other) => other !== person)
    : [...noted, person].sort((a, b) => a - b);
  return { ...play, notes: withCell(play.notes, cell, next) };
}

/** Clears a cell: whoever stands there, else the player's cross, else the notes. */
export function clearCell(play: Play, cell: Cell): Play {
  if (occupantOf(play, cell) !== undefined) {
    return removeFrom(play, cell);
  }
  if (play.crossed[cell]) {
    return { ...play, crossed: withCell(play.crossed, cell, false) };
  }
  if ((play.notes[cell]?.length ?? 0) > 0) {
    return { ...play, notes: withCell(play.notes, cell, []) };
  }
  return play;
}

/** How many people are placed */
export function placedCount(play: Play): number {
  return play.placed.filter((cell) => cell !== undefined).length;
}

/** Whether every person stands where the solution says. The solution is the only one. */
export function isSolved(play: Play, level: Level): boolean {
  return play.placed.every((cell, person) => cell !== undefined && cell === level.solution[person]);
}

/** The suspect who stands in the room of the victim in the solution: the culprit. */
export function culpritOf(level: Level): number {
  const victim = level.people.length - 1;
  const roomOf = level.layout.roomOf;
  const victimRoom = roomOf[level.solution[victim] ?? 0];
  const culprit = level.solution.slice(0, victim).findIndex((cell) => roomOf[cell] === victimRoom);
  if (culprit === -1) {
    throw new Error('The solution has no suspect in the room of the victim');
  }
  return culprit;
}

/** A value with its past and future, for undo and redo. */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Makes a new present. Nothing changes if it is the same value. */
export function record<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) {
    return history;
  }
  return { past: [...history.past, history.present], present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) {
    return history;
  }
  return { past: [...history.past, history.present], present: next, future: rest };
}
