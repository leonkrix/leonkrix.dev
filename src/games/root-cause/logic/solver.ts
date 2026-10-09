import { Board } from './board';
import { check, checkVictimRule, type Context, isStatic, subjectOf, UNPLACED } from './clues';
import { type Cell, type Level } from './types';

/** What the solver needs to know about a puzzle: everything except the solution. */
export type Puzzle = Pick<Level, 'layout' | 'kinds' | 'people' | 'clues'>;

export interface SolveResult {
  /** How many solutions were found, never more than the limit */
  count: number;
  /** The solutions found: the cell of every person */
  solutions: Cell[][];
  /** False when the search was stopped by the node limit before it could be sure */
  complete: boolean;
}

export interface SolveOptions {
  /** Stop after this many solutions (2 is enough to know whether a puzzle is unique) */
  limit?: number;
  /** Give up after this many steps, so a bad puzzle can never run for ever */
  maxNodes?: number;
}

export function contextOf(puzzle: Puzzle): Context {
  return {
    board: new Board(puzzle.layout, puzzle.kinds),
    people: puzzle.people,
    victim: puzzle.people.length - 1,
  };
}

/**
 * Finds the solutions of a puzzle by search: it places the person with the fewest possible cells
 * first, one in every row and every column, and drops a branch as soon as a clue (or the rule
 * about the victim) says no. It does not look at the stored solution at all.
 */
export function solve(puzzle: Puzzle, options: SolveOptions = {}): SolveResult {
  const limit = options.limit ?? 2;
  const maxNodes = options.maxNodes ?? Number.POSITIVE_INFINITY;
  const context = contextOf(puzzle);
  const { board } = context;
  const size = board.size;
  const peopleCount = puzzle.people.length;
  if (peopleCount !== size) {
    throw new RangeError(`A ${String(size)} by ${String(size)} board needs ${String(size)} people`);
  }

  const placement: Cell[] = Array.from({ length: peopleCount }, () => UNPLACED);
  const rowUsed: boolean[] = Array.from({ length: size }, () => false);
  const colUsed: boolean[] = Array.from({ length: size }, () => false);
  const solutions: Cell[][] = [];
  let nodes = 0;
  const stop = { now: false };
  const finished = (): boolean => stop.now || solutions.length >= limit;

  // Clues that only depend on where one person stands are worked out once for every cell. Only the
  // others (relations, counting, clues about the whole map) have to be asked at every step.
  const alone = puzzle.clues.filter(isStatic);
  const dynamic = puzzle.clues.filter((clue) => !isStatic(clue));
  const domain: Cell[][] = Array.from({ length: peopleCount }, (_, person) => {
    const mine = alone.filter((clue) => subjectOf(clue) === person);
    const cells: Cell[] = [];
    for (let cell = 0; cell < board.cellCount; cell += 1) {
      if (board.blocked.has(cell)) {
        continue;
      }
      placement[person] = cell;
      if (mine.every((clue) => check(clue, context, placement) !== false)) {
        cells.push(cell);
      }
      placement[person] = UNPLACED;
    }
    return cells;
  });

  /** The cells where a person could stand now: free row and column, and no clue says no. */
  const feasibleCells = (person: number): Cell[] => {
    const cells: Cell[] = [];
    for (const cell of domain[person] ?? []) {
      if (rowUsed[board.row(cell)] === true || colUsed[board.col(cell)] === true) {
        continue;
      }
      placement[person] = cell;
      const allowed =
        checkVictimRule(context, placement) !== false &&
        dynamic.every((clue) => check(clue, context, placement) !== false);
      placement[person] = UNPLACED;
      if (allowed) {
        cells.push(cell);
      }
    }
    return cells;
  };

  const search = (): void => {
    nodes += 1;
    if (nodes > maxNodes) {
      stop.now = true;
    }
    if (finished()) {
      return;
    }

    let next = -1;
    let nextCells: Cell[] = [];
    for (let person = 0; person < peopleCount; person += 1) {
      if (placement[person] !== UNPLACED) {
        continue;
      }
      const cells = feasibleCells(person);
      if (cells.length === 0) {
        return;
      }
      if (next === -1 || cells.length < nextCells.length) {
        next = person;
        nextCells = cells;
      }
    }

    if (next === -1) {
      solutions.push([...placement]);
      return;
    }

    for (const cell of nextCells) {
      placement[next] = cell;
      rowUsed[board.row(cell)] = true;
      colUsed[board.col(cell)] = true;
      search();
      rowUsed[board.row(cell)] = false;
      colUsed[board.col(cell)] = false;
      placement[next] = UNPLACED;
      if (finished()) {
        return;
      }
    }
  };

  search();
  return { count: solutions.length, solutions, complete: !stop.now };
}
