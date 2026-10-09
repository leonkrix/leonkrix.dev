/**
 * The vocabulary of Root Cause, independent of how a game looks (the "skin") and of the interface.
 *
 * The board is a square of `size` by `size` cells. A cell is a whole number, row times size plus
 * column. Exactly `size` people stand on it, one in every row and one in every column: all but one
 * are suspects, the last one is the victim. The board is divided into rooms. The culprit is the
 * suspect who is alone with the victim in a room. The clues tell where the suspects are, or say
 * something about the whole map.
 */

export type Cell = number;

export type Side = 'n' | 'e' | 's' | 'w';

/** One object on the map. It covers one cell, or two neighbors in the same room (a sofa). */
export interface ObjectPlacement {
  /** The kind of object, a key of `Level.kinds` (for example "chair" or "rack") */
  kind: string;
  cells: readonly Cell[];
}

/** A window sits on one side of a cell, on a wall: the edge of the board or a room boundary. */
export interface WindowEdge {
  cell: Cell;
  side: Side;
}

/** What a room is: its type (several rooms can be of the same type) and the name it is shown with. */
export interface RoomInfo {
  /** The kind of room, for example "server-room" or "break-room" */
  type: string;
  /** The name, numbered when the map has several rooms of the type ("Server room 2") */
  name: string;
}

export interface Layout {
  size: number;
  /** The room of every cell, rooms are numbered from 0 */
  roomOf: readonly number[];
  roomCount: number;
  /** The type and name of every room, in the order of the room numbers */
  rooms: readonly RoomInfo[];
  objects: readonly ObjectPlacement[];
  windows: readonly WindowEdge[];
}

/** The two things the engine needs to know about a kind of object. */
export interface KindInfo {
  /** A person can stand on it (chair, rug, sofa). Everything else blocks the cell. */
  occupiable: boolean;
}

export interface Person {
  /** What kind of person or device this is: a role in Case file, a device type in Outage */
  role: string;
  /** What the person is called */
  name: string;
  /** A short, unique abbreviation for the notes of the player */
  label: string;
}

export type Line = 'firstRow' | 'lastRow' | 'firstCol' | 'lastCol' | 'middleRow' | 'middleCol';

/** The four directions and the four in between */
export type Direction =
  'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

/** How a direction clue is meant: right next to the other person, or anywhere in that direction */
export type DirectionMode = 'adjacent' | 'any';

export type Counting = 'atLeast' | 'exactly';

/** Where a thing is compared with a room: in the same room, or in another one */
export type RoomRelation = 'same' | 'other';

/**
 * Clues about one suspect. The clue about a person who has to meet two conditions at once is a
 * combination of two of them (`and`), and one that meets at least one of two is an `or`.
 */
export type PersonClue =
  // About the room
  | { type: 'inRoom'; person: number; room: number }
  | { type: 'notInRoom'; person: number; room: number }
  | { type: 'inRoomType'; person: number; roomType: string }
  | { type: 'notInRoomType'; person: number; roomType: string }
  | { type: 'sameRoom'; person: number; other: number }
  | { type: 'notSameRoom'; person: number; other: number }
  | { type: 'roomHasWindow'; person: number; has: boolean }
  | { type: 'roomHasKind'; person: number; kind: string; has: boolean }
  | { type: 'roomSize'; person: number; which: 'largest' | 'smallest' }
  // About the objects
  | { type: 'onKind'; person: number; kind: string }
  | { type: 'notOnKind'; person: number; kind: string }
  | { type: 'onFurniture'; person: number }
  | { type: 'onFloor'; person: number }
  | { type: 'soleOnKind'; person: number; kind: string }
  | { type: 'nextToKind'; person: number; kind: string }
  | { type: 'notNextToKind'; person: number; kind: string }
  | { type: 'windowFront'; person: number }
  | { type: 'kindInLine'; person: number; kind: string; axis: 'row' | 'col'; where: RoomRelation }
  | {
      type: 'relativeToKind';
      person: number;
      kind: string;
      direction: Direction;
      where: RoomRelation | 'any';
    }
  // About the position on the board
  | { type: 'corner'; person: number }
  | { type: 'line'; person: number; line: Line }
  | { type: 'nextToWall'; person: number }
  | { type: 'notNextToWall'; person: number }
  // About who else is in the room
  | { type: 'alone'; person: number }
  | { type: 'roomMates'; person: number; counting: Counting; n: number }
  | { type: 'roomRole'; person: number; role: string; counting: Counting | 'none'; n: number }
  // About another person
  | { type: 'direction'; person: number; other: number; direction: Direction; mode: DirectionMode }
  | { type: 'diagonal'; person: number; other: number }
  | { type: 'between'; person: number; other: number; third: number; axis: 'row' | 'col' }
  | { type: 'distance'; person: number; other: number; distance: number };

/** A clue about one person that is made of two simpler clues about the same person */
export type CombinedClue =
  | { type: 'and'; person: number; parts: readonly [PersonClue, PersonClue] }
  | { type: 'or'; person: number; parts: readonly [PersonClue, PersonClue] };

/**
 * Clues that are about no particular person: a room, or the whole map. They count everybody,
 * the victim included, but never name the victim.
 */
export type NeutralClue =
  | { type: 'roomEmpty'; room: number }
  | { type: 'roomCount'; room: number; n: number }
  /** Exactly n rooms have nobody in them (0: no room is empty) */
  | { type: 'emptyRooms'; n: number }
  /** How many people stand on an object of a kind (exactly 0: nobody does) */
  | { type: 'kindCount'; kind: string; counting: Counting; n: number }
  /** Exactly n objects of a kind have nobody on them */
  | { type: 'kindFree'; kind: string; n: number }
  /** Every room holds a different number of people */
  | { type: 'distinctRoomCounts' }
  /** Every room has exactly n people on an object of a kind */
  | { type: 'everyRoomKind'; kind: string; n: number }
  /** Nobody of this role is next to an object of this kind */
  | { type: 'noRoleNextToKind'; role: string; kind: string }
  /** No two people of the same role share a room */
  | { type: 'rolesApart' }
  /** These suspects are all in different rooms */
  | { type: 'separate'; persons: readonly number[] }
  /** Exactly n people stand in a corner */
  | { type: 'cornerCount'; n: number };

export type Clue = PersonClue | CombinedClue | NeutralClue;

export type ClueType = Clue['type'];

/** How hard a clue is to use: 1 is read off the board, 3 needs chains of reasoning. */
export type ClueLevel = 1 | 2 | 3;

export type Tier = 'easy' | 'medium' | 'hard';

/**
 * A puzzle. The solution is stored with it and is the only one: every level is checked by two
 * independent solvers before it is published.
 */
export interface Level {
  layout: Layout;
  kinds: Readonly<Record<string, KindInfo>>;
  /** The people in order: the suspects first and the victim last. */
  people: readonly Person[];
  clues: readonly Clue[];
  /** The cell of every person (same order as `people`) */
  solution: readonly Cell[];
}

/** The index of the victim: always the last person. */
export function victimOf(level: Pick<Level, 'people'>): number {
  return level.people.length - 1;
}
