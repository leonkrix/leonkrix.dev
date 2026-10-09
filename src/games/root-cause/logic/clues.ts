import { type Board } from './board';
import {
  type Cell,
  type Clue,
  type ClueLevel,
  type ClueType,
  type CombinedClue,
  type Counting,
  type Direction,
  type DirectionMode,
  type Line,
  type NeutralClue,
  type Person,
  type PersonClue,
  type RoomRelation,
} from './types';

/** What the clues are checked against: the board and the people (their roles and who is the victim). */
export interface Context {
  board: Board;
  people: readonly Person[];
  /** The index of the victim, the last person */
  victim: number;
}

/** A person who has not been placed yet */
export const UNPLACED = -1;

/**
 * What a clue says about a placement that may still be incomplete: true, false, or not decided
 * yet (undefined). A false answer is final, however the rest is placed. That is what lets the
 * solver cut off whole branches early.
 */
export type Verdict = boolean | undefined;

/**
 * How hard each kind of clue is to use at the least. The generator offers the easy clues on easy
 * levels. A few clues are easier or harder depending on their numbers, see `clueLevelOf`.
 */
export const CLUE_LEVEL: Readonly<Record<ClueType, ClueLevel>> = {
  inRoom: 1,
  inRoomType: 1,
  onKind: 1,
  onFurniture: 1,
  windowFront: 1,
  roomHasWindow: 1,
  roomHasKind: 1,
  corner: 1,
  line: 1,
  sameRoom: 1,
  alone: 1,
  roomMates: 1,
  noRoleNextToKind: 1,
  notInRoom: 2,
  notInRoomType: 2,
  notOnKind: 2,
  onFloor: 2,
  soleOnKind: 2,
  nextToKind: 2,
  notNextToKind: 2,
  nextToWall: 2,
  notNextToWall: 2,
  notSameRoom: 2,
  roomRole: 2,
  roomSize: 2,
  kindInLine: 2,
  relativeToKind: 2,
  direction: 2,
  diagonal: 2,
  and: 2,
  roomEmpty: 2,
  roomCount: 2,
  emptyRooms: 2,
  kindCount: 2,
  rolesApart: 2,
  separate: 2,
  between: 3,
  distance: 3,
  or: 3,
  kindFree: 3,
  distinctRoomCounts: 3,
  everyRoomKind: 3,
  cornerCount: 3,
};

export const CLUE_TYPES = Object.keys(CLUE_LEVEL) as ClueType[];

const NEUTRAL_TYPES: ReadonlySet<ClueType> = new Set<ClueType>([
  'roomEmpty',
  'roomCount',
  'emptyRooms',
  'kindCount',
  'kindFree',
  'distinctRoomCounts',
  'everyRoomKind',
  'noRoleNextToKind',
  'rolesApart',
  'separate',
  'cornerCount',
]);

/** Whether a clue is about no particular person: a room, or the whole map */
export function isNeutral(clue: Clue): clue is NeutralClue {
  return NEUTRAL_TYPES.has(clue.type);
}

/** The suspect a clue is about, or nothing for a clue that is about no one in particular */
export function subjectOf(clue: Clue): number | undefined {
  return isNeutral(clue) ? undefined : clue.person;
}

/** How hard a clue is to use. Combinations and some counts are easier or harder than their type. */
export function clueLevelOf(clue: Clue): ClueLevel {
  switch (clue.type) {
    case 'and':
      return Math.max(2, clueLevelOf(clue.parts[0]), clueLevelOf(clue.parts[1])) as ClueLevel;
    case 'or':
      return 3;
    case 'kindCount':
      return clue.counting === 'exactly' && clue.n === 0 ? 1 : 2;
    case 'emptyRooms':
      return clue.n === 0 ? 2 : 3;
    default:
      return CLUE_LEVEL[clue.type];
  }
}

function cellOf(placement: readonly Cell[], person: number): Cell | undefined {
  const cell = placement[person];
  return cell === undefined || cell === UNPLACED ? undefined : cell;
}

/** The result of counting, when some of the people are not placed yet and could still arrive */
function countingVerdict(
  placed: number,
  open: number,
  counting: Counting | 'none',
  n: number,
): Verdict {
  const most = placed + open;
  if (counting === 'atLeast') {
    if (placed >= n) {
      return true;
    }
    return most < n ? false : undefined;
  }
  const wanted = counting === 'none' ? 0 : n;
  if (placed > wanted || most < wanted) {
    return false;
  }
  return open === 0 ? placed === wanted : undefined;
}

/** How many people are in a room already, and how many are not placed yet and could still be */
function peopleIn(
  context: Context,
  placement: readonly Cell[],
  room: number,
  skip: number,
  matches: (person: number) => boolean = () => true,
): { placed: number; open: number } {
  let placed = 0;
  let open = 0;
  for (let person = 0; person < context.people.length; person += 1) {
    if (person === skip || !matches(person)) {
      continue;
    }
    const cell = cellOf(placement, person);
    if (cell === undefined) {
      open += 1;
    } else if (context.board.roomOf[cell] === room) {
      placed += 1;
    }
  }
  return { placed, open };
}

function lineHolds(board: Board, cell: Cell, line: Line): boolean {
  const last = board.size - 1;
  switch (line) {
    case 'firstRow':
      return board.row(cell) === 0;
    case 'lastRow':
      return board.row(cell) === last;
    case 'firstCol':
      return board.col(cell) === 0;
    case 'lastCol':
      return board.col(cell) === last;
    case 'middleRow':
      return board.row(cell) * 2 === last;
    case 'middleCol':
      return board.col(cell) * 2 === last;
  }
}

/**
 * Whether a cell lies in a direction from another cell. "Any" means anywhere that way (north: a row
 * above; north-east: a row above and a column to the right), "adjacent" means the very next cell.
 */
export function directionHolds(
  board: Board,
  cell: Cell,
  from: Cell,
  direction: Direction,
  mode: DirectionMode,
): boolean {
  const rows = board.row(cell) - board.row(from);
  const cols = board.col(cell) - board.col(from);
  const north = mode === 'adjacent' ? rows === -1 : rows < 0;
  const south = mode === 'adjacent' ? rows === 1 : rows > 0;
  const west = mode === 'adjacent' ? cols === -1 : cols < 0;
  const east = mode === 'adjacent' ? cols === 1 : cols > 0;
  switch (direction) {
    case 'north':
      return north;
    case 'south':
      return south;
    case 'east':
      return east;
    case 'west':
      return west;
    case 'northeast':
      return north && east;
    case 'northwest':
      return north && west;
    case 'southeast':
      return south && east;
    case 'southwest':
      return south && west;
  }
}

/**
 * Some clues look at many cells and are worked out for the same cell again and again during a
 * search. Their answer only depends on the clue, the board and the cell, so it is remembered.
 */
const memory = new WeakMap<Board, WeakMap<object, Int8Array>>();

function remembered(board: Board, clue: object, cell: Cell, work: () => boolean): boolean {
  let perClue = memory.get(board);
  if (perClue === undefined) {
    perClue = new WeakMap();
    memory.set(board, perClue);
  }
  let table = perClue.get(clue);
  if (table === undefined) {
    table = new Int8Array(board.cellCount).fill(-1);
    perClue.set(clue, table);
  }
  const known = table[cell];
  if (known !== undefined && known !== -1) {
    return known === 1;
  }
  const answer = work();
  table[cell] = answer ? 1 : 0;
  return answer;
}

/** The clues whose answer depends only on the cell of the one person they are about */
const STATIC_TYPES: ReadonlySet<ClueType> = new Set<ClueType>([
  'inRoom',
  'notInRoom',
  'inRoomType',
  'notInRoomType',
  'roomHasWindow',
  'roomHasKind',
  'roomSize',
  'onKind',
  'notOnKind',
  'onFurniture',
  'onFloor',
  'nextToKind',
  'notNextToKind',
  'windowFront',
  'kindInLine',
  'relativeToKind',
  'corner',
  'line',
  'nextToWall',
  'notNextToWall',
]);

/** Whether a clue only depends on where the one person it is about stands (not on anybody else) */
export function isStatic(clue: Clue): boolean {
  if (clue.type === 'and' || clue.type === 'or') {
    return clue.parts.every((part) => STATIC_TYPES.has(part.type));
  }
  return STATIC_TYPES.has(clue.type);
}

function isNextToKind(board: Board, cell: Cell, kind: string): boolean {
  return (board.roomNeighbors[cell] ?? []).some((next) => board.kindAt[next] === kind);
}

function relationHolds(
  board: Board,
  cell: Cell,
  other: Cell,
  where: RoomRelation | 'any',
): boolean {
  if (where === 'any') {
    return true;
  }
  return (board.roomOf[cell] === board.roomOf[other]) === (where === 'same');
}

/**
 * Checks one clue against a placement: `placement[person]` is the cell of the person, or
 * UNPLACED. With a complete placement the answer is always true or false.
 */
export function check(clue: Clue, context: Context, placement: readonly Cell[]): Verdict {
  if (isNeutral(clue)) {
    return checkNeutral(clue, context, placement);
  }
  if (clue.type === 'and' || clue.type === 'or') {
    return checkCombined(clue, context, placement);
  }
  return checkPerson(clue, context, placement);
}

function checkCombined(clue: CombinedClue, context: Context, placement: readonly Cell[]): Verdict {
  const results = clue.parts.map((part) => checkPerson(part, context, placement));
  if (clue.type === 'and') {
    if (results.includes(false)) {
      return false;
    }
    return results.every((result) => result === true) ? true : undefined;
  }
  if (results.includes(true)) {
    return true;
  }
  return results.every((result) => result === false) ? false : undefined;
}

function checkPerson(clue: PersonClue, context: Context, placement: readonly Cell[]): Verdict {
  const { board } = context;
  const cell = cellOf(placement, clue.person);
  if (cell === undefined) {
    return undefined;
  }
  const room = board.roomOf[cell] ?? -1;

  switch (clue.type) {
    case 'inRoom':
      return room === clue.room;
    case 'notInRoom':
      return room !== clue.room;
    case 'inRoomType':
      return board.roomType[room] === clue.roomType;
    case 'notInRoomType':
      return board.roomType[room] !== clue.roomType;
    case 'roomHasWindow':
      return board.roomHasWindow[room] === clue.has;
    case 'roomHasKind':
      return (board.roomKinds[room]?.has(clue.kind) ?? false) === clue.has;
    case 'roomSize':
      return room === (clue.which === 'largest' ? board.largestRoom : board.smallestRoom);
    case 'onKind':
      return board.kindAt[cell] === clue.kind;
    case 'notOnKind':
      return board.kindAt[cell] !== clue.kind;
    case 'onFurniture':
      return board.kindAt[cell] !== undefined;
    case 'onFloor':
      return board.kindAt[cell] === undefined;
    case 'nextToKind':
      return isNextToKind(board, cell, clue.kind);
    case 'notNextToKind':
      return !isNextToKind(board, cell, clue.kind);
    case 'windowFront':
      return board.windowCells.has(cell);
    case 'kindInLine':
      return remembered(board, clue, cell, () =>
        (board.kindCells.get(clue.kind) ?? []).some(
          (other) =>
            other !== cell &&
            (clue.axis === 'row'
              ? board.row(other) === board.row(cell)
              : board.col(other) === board.col(cell)) &&
            relationHolds(board, cell, other, clue.where),
        ),
      );
    case 'relativeToKind':
      return remembered(board, clue, cell, () =>
        (board.kindCells.get(clue.kind) ?? []).some(
          (other) =>
            directionHolds(board, cell, other, clue.direction, 'any') &&
            relationHolds(board, cell, other, clue.where),
        ),
      );
    case 'corner':
      return board.isCorner(cell);
    case 'line':
      return lineHolds(board, cell, clue.line);
    case 'nextToWall':
      return board.wallCells.has(cell);
    case 'notNextToWall':
      return !board.wallCells.has(cell);
    case 'soleOnKind': {
      if (board.kindAt[cell] !== clue.kind) {
        return false;
      }
      let open = 0;
      for (let person = 0; person < context.people.length; person += 1) {
        if (person === clue.person) {
          continue;
        }
        const other = cellOf(placement, person);
        if (other === undefined) {
          open += 1;
        } else if (board.kindAt[other] === clue.kind) {
          return false;
        }
      }
      return open === 0 ? true : undefined;
    }
    case 'alone': {
      const { placed, open } = peopleIn(context, placement, room, clue.person);
      return countingVerdict(placed, open, 'none', 0);
    }
    case 'roomMates': {
      const { placed, open } = peopleIn(context, placement, room, clue.person);
      return countingVerdict(placed, open, clue.counting, clue.n);
    }
    case 'roomRole': {
      const { placed, open } = peopleIn(
        context,
        placement,
        room,
        clue.person,
        (person) => context.people[person]?.role === clue.role,
      );
      return countingVerdict(placed, open, clue.counting, clue.n);
    }
    default:
      return checkRelation(clue, context, placement, cell);
  }
}

function checkRelation(
  clue: Extract<
    PersonClue,
    { type: 'sameRoom' | 'notSameRoom' | 'direction' | 'diagonal' | 'distance' | 'between' }
  >,
  context: Context,
  placement: readonly Cell[],
  cell: Cell,
): Verdict {
  const { board } = context;
  const otherCell = cellOf(placement, clue.other);
  if (otherCell === undefined) {
    return undefined;
  }

  switch (clue.type) {
    case 'sameRoom':
      return board.roomOf[cell] === board.roomOf[otherCell];
    case 'notSameRoom':
      return board.roomOf[cell] !== board.roomOf[otherCell];
    case 'direction':
      return directionHolds(board, cell, otherCell, clue.direction, clue.mode);
    case 'diagonal':
      return (
        Math.abs(board.row(cell) - board.row(otherCell)) === 1 &&
        Math.abs(board.col(cell) - board.col(otherCell)) === 1
      );
    case 'distance':
      return (
        Math.abs(board.row(cell) - board.row(otherCell)) +
          Math.abs(board.col(cell) - board.col(otherCell)) ===
        clue.distance
      );
    case 'between': {
      const thirdCell = cellOf(placement, clue.third);
      if (thirdCell === undefined) {
        return undefined;
      }
      const at = (c: Cell): number => (clue.axis === 'row' ? board.row(c) : board.col(c));
      const low = Math.min(at(otherCell), at(thirdCell));
      const high = Math.max(at(otherCell), at(thirdCell));
      return at(cell) > low && at(cell) < high;
    }
  }
}

/** All pairs of two different persons among the given ones */
function pairsOf(persons: readonly number[]): [number, number][] {
  return persons.flatMap((first, index) =>
    persons.slice(index + 1).map((second): [number, number] => [first, second]),
  );
}

function checkNeutral(clue: NeutralClue, context: Context, placement: readonly Cell[]): Verdict {
  const { board, people } = context;
  const everyone = Array.from({ length: people.length }, (_, person) => person);
  const placedCells = everyone.flatMap((person) => {
    const cell = cellOf(placement, person);
    return cell === undefined ? [] : [cell];
  });
  const open = people.length - placedCells.length;

  switch (clue.type) {
    case 'roomEmpty':
    case 'roomCount': {
      const placed = placedCells.filter((cell) => board.roomOf[cell] === clue.room).length;
      return clue.type === 'roomEmpty'
        ? countingVerdict(placed, open, 'none', 0)
        : countingVerdict(placed, open, 'exactly', clue.n);
    }
    case 'emptyRooms': {
      const occupied = new Set(placedCells.map((cell) => board.roomOf[cell])).size;
      const mostEmpty = board.roomCount - occupied;
      const fewestEmpty = Math.max(0, mostEmpty - open);
      if (clue.n > mostEmpty || clue.n < fewestEmpty) {
        return false;
      }
      return open === 0 ? true : undefined;
    }
    case 'kindCount': {
      const placed = placedCells.filter((cell) => board.kindAt[cell] === clue.kind).length;
      return countingVerdict(placed, open, clue.counting, clue.n);
    }
    case 'kindFree': {
      const used = new Set(
        placedCells.flatMap((cell) =>
          board.kindAt[cell] === clue.kind ? [board.objectAt[cell] ?? -1] : [],
        ),
      ).size;
      const mostFree = (board.objectCount.get(clue.kind) ?? 0) - used;
      const fewestFree = Math.max(0, mostFree - open);
      if (clue.n > mostFree || clue.n < fewestFree) {
        return false;
      }
      return open === 0 ? true : undefined;
    }
    case 'distinctRoomCounts': {
      if (open > 0) {
        return undefined;
      }
      const counts = Array.from(
        { length: board.roomCount },
        (_, room) => placedCells.filter((cell) => board.roomOf[cell] === room).length,
      );
      return new Set(counts).size === counts.length;
    }
    case 'everyRoomKind': {
      const counts = Array.from(
        { length: board.roomCount },
        (_, room) =>
          placedCells.filter(
            (cell) => board.roomOf[cell] === room && board.kindAt[cell] === clue.kind,
          ).length,
      );
      if (counts.some((count) => count > clue.n)) {
        return false;
      }
      return open === 0 ? counts.every((count) => count === clue.n) : undefined;
    }
    case 'noRoleNextToKind': {
      const withRole = everyone.filter((person) => people[person]?.role === clue.role);
      let stillOpen = false;
      for (const person of withRole) {
        const cell = cellOf(placement, person);
        if (cell === undefined) {
          stillOpen = true;
        } else if (isNextToKind(board, cell, clue.kind)) {
          return false;
        }
      }
      return stillOpen ? undefined : true;
    }
    case 'rolesApart':
    case 'separate': {
      const persons =
        clue.type === 'separate'
          ? clue.persons
          : everyone.filter((person) => people[person] !== undefined);
      let stillOpen = false;
      for (const [first, second] of pairsOf(persons)) {
        if (clue.type === 'rolesApart' && people[first]?.role !== people[second]?.role) {
          continue;
        }
        const here = cellOf(placement, first);
        const there = cellOf(placement, second);
        if (here === undefined || there === undefined) {
          stillOpen = true;
        } else if (board.roomOf[here] === board.roomOf[there]) {
          return false;
        }
      }
      return stillOpen ? undefined : true;
    }
    case 'cornerCount': {
      const placed = placedCells.filter((cell) => board.isCorner(cell)).length;
      return countingVerdict(placed, open, 'exactly', clue.n);
    }
  }
}

/**
 * The rule that is always in force and is not shown as a clue: the victim is alone with the
 * culprit, so exactly one suspect shares the room of the victim.
 */
export function checkVictimRule(context: Context, placement: readonly Cell[]): Verdict {
  const cell = cellOf(placement, context.victim);
  if (cell === undefined) {
    return undefined;
  }
  const { placed, open } = peopleIn(
    context,
    placement,
    context.board.roomOf[cell] ?? -1,
    context.victim,
  );
  return countingVerdict(placed, open, 'exactly', 1);
}

/** Everything a complete placement must satisfy: the clues and the rule about the victim. */
export function isSolution(
  clues: readonly Clue[],
  context: Context,
  placement: readonly Cell[],
): boolean {
  return (
    checkVictimRule(context, placement) === true &&
    clues.every((clue) => check(clue, context, placement) === true)
  );
}

/** The people a clue mentions (the person it is about, and the others it names) */
export function mentions(clue: Clue): readonly number[] {
  switch (clue.type) {
    case 'and':
    case 'or':
      return [...new Set(clue.parts.flatMap((part) => mentions(part)))];
    case 'separate':
      return clue.persons;
    case 'between':
      return [clue.person, clue.other, clue.third];
    case 'sameRoom':
    case 'notSameRoom':
    case 'direction':
    case 'diagonal':
    case 'distance':
      return [clue.person, clue.other];
    default:
      return isNeutral(clue) ? [] : [clue.person];
  }
}
