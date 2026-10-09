import { type Board } from './board';
import { check, clueLevelOf, type Context, isSolution, mentions, UNPLACED } from './clues';
import { contextOf, type Puzzle } from './solver';
import { type Cell, type Clue, type ClueType } from './types';

/**
 * A second way to solve a puzzle, the way a person does: every person has a set of cells where
 * they could still stand, and rules strike cells from the sets until only one is left for each.
 *
 * Level 1 rules: a person with one cell left, a row or column with one place left, a person who
 * is bound to a row or a column. Level 2 rules: the clues that relate people to each other, empty
 * rooms, the victim and the culprit. Level 3: try a cell and see whether it leads to a
 * contradiction ("what if"). The rater uses the levels to tell how hard a puzzle is, and the
 * second solver at the end counts solutions without using the search of solver.ts at all.
 */

export interface State {
  /** For every person, a flag for every cell: could they still stand there? */
  domains: Uint8Array[];
}

export interface Engine {
  context: Context;
  board: Board;
  clues: readonly Clue[];
  people: number;
  /** The clues that tie people together and are used by the level 2 rule for relations */
  relations: readonly Clue[];
  /** How often a rule was applied, per level */
  steps: [number, number, number, number];
}

const RELATION_TYPES: readonly ClueType[] = [
  'sameRoom',
  'notSameRoom',
  'direction',
  'diagonal',
  'distance',
  'between',
];

/**
 * The clues that tie people together, as the relation rule sees them: the clues about two or
 * three people, combinations that name another person, and the "apart" clues cut into pairs of
 * people who are not in the same room.
 */
function relationsOf(puzzle: Puzzle): Clue[] {
  const apart = (first: number, second: number): Clue => ({
    type: 'notSameRoom',
    person: first,
    other: second,
  });
  return puzzle.clues.flatMap((clue): Clue[] => {
    if (RELATION_TYPES.includes(clue.type)) {
      return [clue];
    }
    if ((clue.type === 'and' || clue.type === 'or') && mentions(clue).length >= 2) {
      return [clue];
    }
    if (clue.type === 'separate') {
      return clue.persons.flatMap((first, index) =>
        clue.persons.slice(index + 1).map((second) => apart(first, second)),
      );
    }
    if (clue.type === 'rolesApart') {
      const pairs: Clue[] = [];
      puzzle.people.forEach((first, one) => {
        puzzle.people.forEach((second, two) => {
          if (two > one && first.role === second.role) {
            pairs.push(apart(one, two));
          }
        });
      });
      return pairs;
    }
    return [];
  });
}

export function candidates(state: State, person: number): Cell[] {
  const flags = state.domains[person];
  const cells: Cell[] = [];
  flags?.forEach((flag, cell) => {
    if (flag === 1) {
      cells.push(cell);
    }
  });
  return cells;
}

function cloneState(state: State): State {
  return { domains: state.domains.map((flags) => Uint8Array.from(flags)) };
}

/** Removes a cell from a person. Returns true when something changed. */
function remove(state: State, person: number, cell: Cell): boolean {
  const flags = state.domains[person];
  if (flags?.[cell] !== 1) {
    return false;
  }
  flags[cell] = 0;
  return true;
}

function keepOnly(state: State, person: number, allowed: (cell: Cell) => boolean): boolean {
  let changed = false;
  for (const cell of candidates(state, person)) {
    if (!allowed(cell)) {
      changed = remove(state, person, cell) || changed;
    }
  }
  return changed;
}

/** The domains at the start: nobody on a blocked cell, and every clue about a single person applied. */
export function initialState(engine: Engine): State | undefined {
  const { board, people } = engine;
  const state: State = {
    domains: Array.from({ length: people }, () => new Uint8Array(board.cellCount).fill(1)),
  };
  const placement: Cell[] = Array.from({ length: people }, () => UNPLACED);
  for (let person = 0; person < people; person += 1) {
    for (let cell = 0; cell < board.cellCount; cell += 1) {
      if (board.blocked.has(cell)) {
        remove(state, person, cell);
        continue;
      }
      placement[person] = cell;
      const allowed = engine.clues.every(
        (clue) => check(clue, engine.context, placement) !== false,
      );
      placement[person] = UNPLACED;
      if (!allowed) {
        remove(state, person, cell);
      }
    }
  }
  return state;
}

/** Level 1: singles, and people who are bound to a row or a column. Returns undefined on a contradiction. */
function levelOne(engine: Engine, state: State): boolean | undefined {
  const { board, people } = engine;
  let changed = false;

  for (let person = 0; person < people; person += 1) {
    const cells = candidates(state, person);
    if (cells.length === 0) {
      return undefined;
    }
    const [only] = cells;
    if (cells.length === 1 && only !== undefined) {
      // This person is placed: nobody else may stand on the cell, in its row or in its column
      for (let other = 0; other < people; other += 1) {
        if (other === person) {
          continue;
        }
        for (const cell of candidates(state, other)) {
          if (board.row(cell) === board.row(only) || board.col(cell) === board.col(only)) {
            changed = remove(state, other, cell) || changed;
          }
        }
      }
    }
    // Bound to one row or one column: the others cannot use it
    for (const lineOf of [(cell: Cell) => board.row(cell), (cell: Cell) => board.col(cell)]) {
      const lines = new Set(cells.map(lineOf));
      const [line] = [...lines];
      if (lines.size === 1 && line !== undefined) {
        for (let other = 0; other < people; other += 1) {
          if (other === person) {
            continue;
          }
          for (const cell of candidates(state, other)) {
            if (lineOf(cell) === line) {
              changed = remove(state, other, cell) || changed;
            }
          }
        }
      }
    }
  }

  // A row or a column with a single place left: the person who can take it must
  for (const lineOf of [(cell: Cell) => board.row(cell), (cell: Cell) => board.col(cell)]) {
    for (let line = 0; line < board.size; line += 1) {
      const places: [number, Cell][] = [];
      for (let person = 0; person < people; person += 1) {
        for (const cell of candidates(state, person)) {
          if (lineOf(cell) === line) {
            places.push([person, cell]);
          }
        }
      }
      if (places.length === 0) {
        return undefined;
      }
      const [first] = places;
      if (places.length === 1 && first !== undefined) {
        const [person, cell] = first;
        changed = keepOnly(state, person, (c) => c === cell) || changed;
      }
    }
  }
  return changed;
}

/** Whether a person certainly stands inside a set of cells (all of their cells are in it) */
function mustBeIn(state: State, person: number, inside: (cell: Cell) => boolean): boolean {
  const cells = candidates(state, person);
  return cells.length > 0 && cells.every(inside);
}

function canBeIn(state: State, person: number, inside: (cell: Cell) => boolean): boolean {
  return candidates(state, person).some(inside);
}

/** Level 2, rule for clues that relate two or three people: keep only cells that have support. */
function relations(engine: Engine, state: State): boolean | undefined {
  const { board, people } = engine;
  let changed = false;

  for (const clue of engine.relations) {
    if (clue.type === 'between') {
      const outcome = betweenRule(engine, state, clue);
      if (outcome === undefined) {
        return undefined;
      }
      changed = outcome || changed;
      continue;
    }
    const involved = mentions(clue);
    const placement: Cell[] = Array.from({ length: people }, () => UNPLACED);

    const supported = (person: number, cell: Cell): boolean => {
      const others = involved.filter((other) => other !== person);
      const search = (index: number): boolean => {
        const other = others[index];
        if (other === undefined) {
          return check(clue, engine.context, placement) === true;
        }
        for (const next of candidates(state, other)) {
          const clash = [person, ...others.slice(0, index)].some((placed) => {
            const at = placement[placed] ?? UNPLACED;
            return (
              at === next || board.row(at) === board.row(next) || board.col(at) === board.col(next)
            );
          });
          if (clash) {
            continue;
          }
          placement[other] = next;
          const found = search(index + 1);
          placement[other] = UNPLACED;
          if (found) {
            return true;
          }
        }
        return false;
      };
      placement[person] = cell;
      const found = search(0);
      placement[person] = UNPLACED;
      return found;
    };

    for (const person of involved) {
      for (const cell of candidates(state, person)) {
        if (!supported(person, cell)) {
          changed = remove(state, person, cell) || changed;
        }
      }
      if (candidates(state, person).length === 0) {
        return undefined;
      }
    }
  }
  return changed;
}

/**
 * Between: only the rows (or columns) matter, so the rule looks at the rows that are still possible.
 * It ignores that the other coordinates must differ as well, which makes it a little weaker but
 * never wrong.
 */
function betweenRule(
  engine: Engine,
  state: State,
  clue: Extract<Clue, { type: 'between' }>,
): boolean | undefined {
  const { board } = engine;
  const at = (cell: Cell): number => (clue.axis === 'row' ? board.row(cell) : board.col(cell));
  const values = (person: number): number[] => [...new Set(candidates(state, person).map(at))];
  const [subject, first, second] = [clue.person, clue.other, clue.third];
  let changed = false;

  for (const cell of candidates(state, subject)) {
    const mine = at(cell);
    const possible = values(first).some((a) =>
      values(second).some(
        (b) =>
          a !== b && a !== mine && b !== mine && mine > Math.min(a, b) && mine < Math.max(a, b),
      ),
    );
    if (!possible) {
      changed = remove(state, subject, cell) || changed;
    }
  }
  // The two outer people have to leave room on both sides of the person in the middle
  for (const [outer, other] of [
    [first, second],
    [second, first],
  ] as const) {
    for (const cell of candidates(state, outer)) {
      const a = at(cell);
      const possible = values(subject).some((mid) =>
        values(other).some(
          (b) => b !== a && mid !== a && mid !== b && mid > Math.min(a, b) && mid < Math.max(a, b),
        ),
      );
      if (!possible) {
        changed = remove(state, outer, cell) || changed;
      }
    }
  }
  for (const person of [subject, first, second]) {
    if (candidates(state, person).length === 0) {
      return undefined;
    }
  }
  return changed;
}

/** Level 2, rules for rooms: empty rooms, the sole person on a kind of object, alone, and the victim. */
function rooms(engine: Engine, state: State): boolean | undefined {
  const { board, people, context } = engine;
  let changed = false;
  const suspects = Array.from({ length: people - 1 }, (_, person) => person);
  const roomOfCell = (cell: Cell): number => board.roomOf[cell] ?? -1;

  for (const clue of engine.clues) {
    if (clue.type === 'roomEmpty') {
      for (let person = 0; person < people; person += 1) {
        changed = keepOnly(state, person, (cell) => roomOfCell(cell) !== clue.room) || changed;
      }
    } else if (clue.type === 'soleOnKind') {
      // The person is on this kind of object, so nobody else may be on any object of that kind
      for (let other = 0; other < people; other += 1) {
        if (other !== clue.person) {
          changed = keepOnly(state, other, (cell) => board.kindAt[cell] !== clue.kind) || changed;
        }
      }
    } else if (clue.type === 'kindCount') {
      const onKind = (cell: Cell): boolean => board.kindAt[cell] === clue.kind;
      const everyone = Array.from({ length: people }, (_, person) => person);
      const must = everyone.filter((person) => mustBeIn(state, person, onKind));
      const can = everyone.filter((person) => canBeIn(state, person, onKind));
      const wrong =
        clue.counting === 'exactly'
          ? must.length > clue.n || can.length < clue.n
          : can.length < clue.n;
      if (wrong) {
        return undefined;
      }
      if (clue.counting === 'exactly' && must.length === clue.n) {
        for (const person of everyone.filter((other) => !must.includes(other))) {
          changed = keepOnly(state, person, (cell) => !onKind(cell)) || changed;
        }
      }
      if (can.length === clue.n) {
        for (const person of can) {
          changed = keepOnly(state, person, onKind) || changed;
        }
      }
    } else if (clue.type === 'emptyRooms' && clue.n === 0) {
      // Every room has somebody: a room that only one person can reach is theirs
      for (let room = 0; room < board.roomCount; room += 1) {
        const inRoom = (cell: Cell): boolean => roomOfCell(cell) === room;
        const able = Array.from({ length: people }, (_, person) => person).filter((person) =>
          canBeIn(state, person, inRoom),
        );
        const [only] = able;
        if (able.length === 0) {
          return undefined;
        }
        if (able.length === 1 && only !== undefined) {
          changed = keepOnly(state, only, inRoom) || changed;
        }
      }
    } else if (clue.type === 'alone') {
      const { person } = clue;
      // A cell is no good if somebody else has to be in its room
      for (const cell of candidates(state, person)) {
        const room = roomOfCell(cell);
        const crowded = Array.from({ length: people }, (_, other) => other).some(
          (other) => other !== person && mustBeIn(state, other, (c) => roomOfCell(c) === room),
        );
        if (crowded) {
          changed = remove(state, person, cell) || changed;
        }
      }
      // If the person has to be in one room, nobody else may be there
      const rooms = new Set(candidates(state, person).map(roomOfCell));
      const [room] = [...rooms];
      if (rooms.size === 1 && room !== undefined) {
        for (let other = 0; other < people; other += 1) {
          if (other !== person) {
            changed = keepOnly(state, other, (cell) => roomOfCell(cell) !== room) || changed;
          }
        }
      }
    }
  }

  // The victim is alone with the culprit: exactly one suspect shares the room of the victim
  const { victim } = context;
  for (const cell of candidates(state, victim)) {
    const room = roomOfCell(cell);
    const inRoom = (c: Cell): boolean => roomOfCell(c) === room;
    const must = suspects.filter((person) => mustBeIn(state, person, inRoom)).length;
    const can = suspects.filter((person) => canBeIn(state, person, inRoom)).length;
    if (must > 1 || can < 1) {
      changed = remove(state, victim, cell) || changed;
    }
  }
  const victimRooms = new Set(candidates(state, victim).map(roomOfCell));
  const [victimRoom] = [...victimRooms];
  if (victimRooms.size === 1 && victimRoom !== undefined) {
    const inRoom = (c: Cell): boolean => roomOfCell(c) === victimRoom;
    const able = suspects.filter((person) => canBeIn(state, person, inRoom));
    const [onlyOne] = able;
    if (able.length === 1 && onlyOne !== undefined) {
      changed = keepOnly(state, onlyOne, inRoom) || changed;
    }
    const bound = suspects.filter((person) => mustBeIn(state, person, inRoom));
    const [theOne] = bound;
    if (bound.length === 1 && theOne !== undefined) {
      for (const person of suspects) {
        if (person !== theOne) {
          changed = keepOnly(state, person, (cell) => !inRoom(cell)) || changed;
        }
      }
    }
  }

  for (let person = 0; person < people; person += 1) {
    if (candidates(state, person).length === 0) {
      return undefined;
    }
  }
  return changed;
}

type Outcome = 'contradiction' | 'stuck' | 'solved';

function isDecided(engine: Engine, state: State): boolean {
  return Array.from({ length: engine.people }, (_, person) => person).every(
    (person) => candidates(state, person).length === 1,
  );
}

function placementOf(engine: Engine, state: State): Cell[] {
  return Array.from(
    { length: engine.people },
    (_, person) => candidates(state, person)[0] ?? UNPLACED,
  );
}

/**
 * Applies the rules up to the given level until nothing changes. The level 1 rules always run first,
 * so a puzzle is only credited with level 2 when level 1 was not enough.
 */
function propagate(engine: Engine, state: State, maxLevel: 1 | 2, count: boolean): Outcome {
  for (;;) {
    const one = levelOne(engine, state);
    if (one === undefined) {
      return 'contradiction';
    }
    if (one) {
      if (count) {
        engine.steps[1] += 1;
      }
      continue;
    }
    if (maxLevel === 2) {
      const relational = relations(engine, state);
      if (relational === undefined) {
        return 'contradiction';
      }
      const room = rooms(engine, state);
      if (room === undefined) {
        return 'contradiction';
      }
      if (relational || room) {
        if (count) {
          engine.steps[2] += 1;
        }
        continue;
      }
    }
    break;
  }
  if (isDecided(engine, state)) {
    return isSolution(engine.clues, engine.context, placementOf(engine, state))
      ? 'solved'
      : 'contradiction';
  }
  return 'stuck';
}

export function engineOf(puzzle: Puzzle): Engine {
  const context = contextOf(puzzle);
  return {
    context,
    board: context.board,
    clues: puzzle.clues,
    people: puzzle.people.length,
    relations: relationsOf(puzzle),
    steps: [0, 0, 0, 0],
  };
}

/** The result of the rater */
export interface Rating {
  /** Whether the rules and the what-if step (see below) alone were enough to solve the puzzle */
  solved: boolean;
  /**
   * The highest kind of reasoning that was needed: 1 singles and clues about one person, 2 clues
   * about several people and rooms, 3 trying a cell and finding a contradiction ("what if"), 4 more
   * than that, which is too much to ask of a player.
   */
  level: 1 | 2 | 3 | 4;
  /** The highest level among the clues that are in the puzzle */
  clueLevel: 1 | 2 | 3;
  steps: number;
}

/** Solves the puzzle with the rules, level by level, and reports what was needed. */
export function rate(puzzle: Puzzle): Rating {
  const engine = engineOf(puzzle);
  const clueLevel = engine.clues.reduce<1 | 2 | 3>(
    (most, clue) => Math.max(most, clueLevelOf(clue)) as 1 | 2 | 3,
    1,
  );
  const start = initialState(engine);
  if (start === undefined) {
    return { solved: false, level: 4, clueLevel, steps: 0 };
  }

  const first = propagate(engine, start, 1, true);
  if (first === 'solved') {
    return { solved: true, level: 1, clueLevel, steps: engine.steps[1] };
  }
  const second = first === 'stuck' ? propagate(engine, start, 2, true) : first;
  if (second === 'solved') {
    return {
      solved: true,
      level: engine.steps[2] > 0 ? 2 : 1,
      clueLevel,
      steps: engine.steps[1] + engine.steps[2],
    };
  }
  if (second === 'contradiction') {
    return { solved: false, level: 4, clueLevel, steps: engine.steps[1] + engine.steps[2] };
  }

  // What if: try every cell that is left, and strike the ones that lead to a contradiction
  for (let round = 0; round < 200; round += 1) {
    let progress = false;
    for (let person = 0; person < engine.people; person += 1) {
      for (const cell of candidates(start, person)) {
        if (candidates(start, person).length === 1) {
          break;
        }
        const trial = cloneState(start);
        keepOnly(trial, person, (c) => c === cell);
        if (propagate(engine, trial, 2, false) === 'contradiction') {
          remove(start, person, cell);
          engine.steps[3] += 1;
          progress = true;
        }
      }
    }
    const outcome = propagate(engine, start, 2, false);
    if (outcome === 'solved') {
      return {
        solved: true,
        level: 3,
        clueLevel,
        steps: engine.steps[1] + engine.steps[2] + engine.steps[3],
      };
    }
    if (outcome === 'contradiction') {
      break;
    }
    if (!progress) {
      break;
    }
  }
  return {
    solved: false,
    level: 4,
    clueLevel,
    steps: engine.steps[1] + engine.steps[2] + engine.steps[3],
  };
}

/**
 * Counts the solutions of a puzzle with the rules and a search that tries the person with the
 * fewest cells left. It is a second solver that shares no search code with solver.ts, so the two
 * can be used to check each other.
 */
export function countByPropagation(
  puzzle: Puzzle,
  limit = 2,
  maxNodes = 2_000_000,
): { count: number; solutions: Cell[][]; complete: boolean } {
  const engine = engineOf(puzzle);
  const solutions: Cell[][] = [];
  let nodes = 0;
  const stop = { now: false };
  const finished = (): boolean => stop.now || solutions.length >= limit;

  const visit = (state: State): void => {
    nodes += 1;
    if (nodes > maxNodes) {
      stop.now = true;
    }
    if (finished()) {
      return;
    }
    const outcome = propagate(engine, state, 2, false);
    if (outcome === 'contradiction') {
      return;
    }
    if (outcome === 'solved') {
      solutions.push(placementOf(engine, state));
      return;
    }
    let best = -1;
    let fewest = Number.POSITIVE_INFINITY;
    for (let person = 0; person < engine.people; person += 1) {
      const size = candidates(state, person).length;
      if (size > 1 && size < fewest) {
        best = person;
        fewest = size;
      }
    }
    for (const cell of candidates(state, best)) {
      const branch = cloneState(state);
      keepOnly(branch, best, (c) => c === cell);
      visit(branch);
      if (finished()) {
        return;
      }
    }
  };

  const start = initialState(engine);
  if (start !== undefined) {
    visit(start);
  }
  return { count: solutions.length, solutions, complete: !stop.now };
}
