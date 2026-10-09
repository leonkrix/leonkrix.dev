import { type Random } from '../../shared/random';
import { Board, SIDES } from './board';
import { kindsOf, type RoomTypeDef, type Skin } from './skin';
import {
  type Cell,
  type Layout,
  type ObjectPlacement,
  type RoomInfo,
  type Side,
  type Tier,
  type WindowEdge,
} from './types';

/**
 * How many rooms a board of this size has at least and at most. There is no sharp rule beyond
 * that: an easy 6 by 6 board can have five rooms and a hard one only three. The tier only makes
 * some counts more likely than others.
 */
const ROOM_COUNTS: Readonly<Record<number, readonly [number, number]>> = {
  4: [2, 4],
  5: [2, 5],
  6: [3, 7],
  7: [3, 8],
  8: [4, 9],
  9: [4, 9],
};

export const SIZES = Object.keys(ROOM_COUNTS).map(Number);

export function roomCountRange(size: number): readonly [number, number] {
  const range = ROOM_COUNTS[size];
  if (range === undefined) {
    throw new RangeError(`There is no layout for a board of ${String(size)} by ${String(size)}`);
  }
  return range;
}

/** A random weighted choice: the weights say how likely each entry is */
function pickWeighted<T>(entries: readonly T[], weight: (entry: T) => number, random: Random): T {
  const total = entries.reduce((sum, entry) => sum + weight(entry), 0);
  let point = random.next() * total;
  for (const entry of entries) {
    point -= weight(entry);
    if (point < 0) {
      return entry;
    }
  }
  return random.pick(entries);
}

export function roomCountFor(size: number, tier: Tier, random: Random): number {
  const [low, high] = roomCountRange(size);
  const counts = Array.from({ length: high - low + 1 }, (_, index) => low + index);
  // Easy levels lean towards more (and smaller) rooms, hard levels towards fewer
  const weight = (count: number): number => {
    const above = count - low + 1;
    const below = high - count + 1;
    return tier === 'easy' ? above : tier === 'hard' ? below : 1 + Math.min(above, below);
  };
  return pickWeighted(counts, weight, random);
}

interface Grown {
  roomOf: number[];
  /** The number of the corridor room, if the map has one */
  corridor: number | undefined;
}

/** The smallest box around a set of cells, as its height and width */
function boxOf(board: Pick<Board, 'row' | 'col'>, cells: readonly Cell[]): [number, number] {
  const rows = cells.map((cell) => board.row(cell));
  const cols = cells.map((cell) => board.col(cell));
  return [Math.max(...rows) - Math.min(...rows) + 1, Math.max(...cols) - Math.min(...cols) + 1];
}

/**
 * Splits the board into connected rooms. They grow from random starting cells, and a cell is more
 * likely to join the room it touches on two sides, which makes the rooms compact. Sometimes one
 * room is a corridor: a straight strip, laid first. A map has at most one.
 */
function growRooms(
  size: number,
  roomCount: number,
  withCorridor: boolean,
  random: Random,
): Grown | undefined {
  const total = size * size;
  const roomOf: number[] = Array.from({ length: total }, () => -1);
  const probe = new Board(
    {
      size,
      roomOf: roomOf.map(() => 0),
      roomCount: 1,
      rooms: [{ type: '', name: '' }],
      objects: [],
      windows: [],
    },
    {},
  );

  let corridor: number | undefined;
  let next = 0;
  if (withCorridor) {
    const length = 3 + random.int(Math.max(1, size - 3));
    const horizontal = random.int(2) === 0;
    const line = random.int(size);
    const start = random.int(size - length + 1);
    for (let step = 0; step < length; step += 1) {
      const cell = horizontal ? probe.cellAt(line, start + step) : probe.cellAt(start + step, line);
      roomOf[cell] = next;
    }
    corridor = next;
    next += 1;
  }

  const free = random.shuffle(
    Array.from({ length: total }, (_, cell) => cell).filter((cell) => roomOf[cell] === -1),
  );
  for (const cell of free.slice(0, roomCount - next)) {
    roomOf[cell] = next;
    next += 1;
  }

  while (roomOf.includes(-1)) {
    // Every empty cell that touches a room can be taken by that room; the more sides, the likelier
    const options: { cell: Cell; room: number; sides: number }[] = [];
    for (let cell = 0; cell < total; cell += 1) {
      if (roomOf[cell] !== -1) {
        continue;
      }
      const touching = new Map<number, number>();
      for (const side of SIDES) {
        const neighbor = probe.step(cell, side);
        const room = neighbor === undefined ? -1 : (roomOf[neighbor] ?? -1);
        // The corridor stays what it is: nothing grows onto it
        if (room !== -1 && room !== corridor) {
          touching.set(room, (touching.get(room) ?? 0) + 1);
        }
      }
      for (const [room, sides] of touching) {
        options.push({ cell, room, sides });
      }
    }
    if (options.length === 0) {
      return undefined;
    }
    const chosen = pickWeighted(options, ({ sides }) => sides * sides, random);
    roomOf[chosen.cell] = chosen.room;
  }

  // Judge the shapes: connected by construction, but not too thin, and no second corridor
  for (let room = 0; room < roomCount; room += 1) {
    const cells = roomOf.flatMap((owner, cell) => (owner === room ? [cell] : []));
    if (cells.length < (room === corridor ? 3 : 2)) {
      return undefined;
    }
    if (room === corridor) {
      continue;
    }
    const [height, width] = boxOf(probe, cells);
    const thin = Math.min(height, width) === 1 && cells.length >= 3;
    const loose = cells.length / (height * width) < 0.55;
    if (thin || loose) {
      return undefined;
    }
  }
  return { roomOf, corridor };
}

/** Types and names of the rooms: one type each (several rooms can share a type), numbered if they do. */
function nameRooms(
  skin: Skin,
  roomCount: number,
  corridor: number | undefined,
  random: Random,
): RoomInfo[] {
  const used = new Map<string, number>();
  const ordinary = skin.roomTypes.filter((type) => type.corridor !== true);
  const types: RoomTypeDef[] = Array.from({ length: roomCount }, (_, room) => {
    const corridorType = skin.roomTypes.find((type) => type.corridor === true);
    if (room === corridor && corridorType !== undefined) {
      return corridorType;
    }
    // Rooms of a type that is already on the map are less likely, but possible
    const type = pickWeighted(
      ordinary,
      (entry) => entry.weight / (1 + (used.get(entry.id) ?? 0)),
      random,
    );
    used.set(type.id, (used.get(type.id) ?? 0) + 1);
    return type;
  });
  const counts = new Map<string, number>();
  for (const type of types) {
    counts.set(type.id, (counts.get(type.id) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return types.map((type) => {
    const number = (seen.get(type.id) ?? 0) + 1;
    seen.set(type.id, number);
    return {
      type: type.id,
      name: (counts.get(type.id) ?? 0) > 1 ? `${type.name} ${String(number)}` : type.name,
    };
  });
}

/** The walls of the layout where a window can be: the board edge and the room boundaries. */
function wallEdges(board: Board): WindowEdge[] {
  const edges: WindowEdge[] = [];
  for (let cell = 0; cell < board.cellCount; cell += 1) {
    for (const side of SIDES) {
      const next = board.step(cell, side);
      // A boundary between two cells is listed once, from the cell with the smaller number
      if (next === undefined || (board.roomOf[next] !== board.roomOf[cell] && cell < next)) {
        edges.push({ cell, side });
      }
    }
  }
  return edges;
}

/** Picks a kind of object that fits the room: more likely the better it fits. */
function pickKind(
  skin: Skin,
  occupiable: boolean,
  roomType: RoomTypeDef | undefined,
  random: Random,
): string {
  const options = Object.entries(skin.kinds).filter(([, kind]) => kind.occupiable === occupiable);
  const fit = (id: string): number => roomType?.affinity[id] ?? 0.3;
  const total = options.reduce((sum, [id, kind]) => sum + kind.weight * fit(id), 0);
  if (total <= 0) {
    return options[0]?.[0] ?? '';
  }
  let point = random.next() * total;
  for (const [id, kind] of options) {
    point -= kind.weight * fit(id);
    if (point < 0) {
      return id;
    }
  }
  return options[0]?.[0] ?? '';
}

/** Puts the objects on the map: places to stand on, and things that block a cell. */
function placeObjects(skin: Skin, board: Board, tier: Tier, random: Random): ObjectPlacement[] {
  const { size } = board;
  const standCount =
    tier === 'easy' ? Math.ceil(size * 1.2) : tier === 'medium' ? size : Math.max(2, size - 2);
  // Easy maps have more blocked cells, so there is less free space and it is clearer where people can
  // be; hard maps have more open floor
  const blockCount =
    tier === 'easy'
      ? Math.ceil(size * 0.7)
      : tier === 'medium'
        ? Math.floor(size / 2)
        : Math.max(1, Math.floor(size / 3));
  const taken = new Set<Cell>();
  const blocked = new Set<Cell>();
  const objects: ObjectPlacement[] = [];

  /** Blocking a cell must leave room to stand: in every row, every column and every room */
  const leavesRoom = (cells: readonly Cell[]): boolean => {
    const after = new Set([...blocked, ...cells]);
    const free = (group: readonly Cell[]): number => group.filter((c) => !after.has(c)).length;
    return cells.every((cell) => {
      const row = Array.from({ length: size }, (_, col) => board.cellAt(board.row(cell), col));
      const col = Array.from({ length: size }, (_, r) => board.cellAt(r, board.col(cell)));
      return (
        free(row) >= 2 &&
        free(col) >= 2 &&
        free(board.roomCells[board.roomOf[cell] ?? 0] ?? []) >= 1
      );
    });
  };

  const place = (occupiable: boolean): void => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const start = random.int(board.cellCount);
      const roomType = skin.roomTypes.find(
        (type) => type.id === board.roomType[board.roomOf[start] ?? 0],
      );
      const kind = pickKind(skin, occupiable, roomType, random);
      const def = skin.kinds[kind];
      if (def === undefined) {
        return;
      }
      const cells: Cell[] = [start];
      if (def.cells === 2) {
        const neighbors = board.roomNeighbors[start] ?? [];
        if (neighbors.length === 0) {
          continue;
        }
        cells.push(random.pick(neighbors));
      }
      if (cells.some((cell) => taken.has(cell))) {
        continue;
      }
      if (!occupiable && !leavesRoom(cells)) {
        continue;
      }
      for (const cell of cells) {
        taken.add(cell);
        if (!occupiable) {
          blocked.add(cell);
        }
      }
      objects.push({ kind, cells });
      return;
    }
  };

  for (let index = 0; index < blockCount; index += 1) {
    place(false);
  }
  for (let index = 0; index < standCount; index += 1) {
    place(true);
  }
  return objects;
}

/** A random map: rooms with names, windows and objects, for the given skin and difficulty. */
export function generateLayout(skin: Skin, size: number, tier: Tier, random: Random): Layout {
  const roomCount = roomCountFor(size, tier, random);
  const hasCorridorType = skin.roomTypes.some((type) => type.corridor === true);
  // About one map in three has a corridor, on boards that are big enough for one
  const wantsCorridor = hasCorridorType && size >= 5 && roomCount >= 3 && random.int(3) === 0;

  let grown: Grown | undefined;
  for (let attempt = 0; attempt < 400 && grown === undefined; attempt += 1) {
    // A corridor that does not work out is given up after a while
    grown = growRooms(size, roomCount, wantsCorridor && attempt < 200, random);
  }
  if (grown === undefined) {
    throw new Error('Could not divide the board into rooms');
  }

  const rooms = nameRooms(skin, roomCount, grown.corridor, random);
  const plain: Layout = { size, roomOf: grown.roomOf, roomCount, rooms, objects: [], windows: [] };
  const board = new Board(plain, kindsOf(skin));

  const edges = wallEdges(board);
  const windowCount = Math.min(edges.length, 1 + Math.floor(size / 3) + random.int(2));
  const windows = random.shuffle(edges).slice(0, windowCount);

  const objects = placeObjects(skin, board, tier, random);
  return { ...plain, objects, windows: windows.sort(byCell) };
}

const SIDE_ORDER: Record<Side, number> = { n: 0, e: 1, s: 2, w: 3 };

function byCell(a: WindowEdge, b: WindowEdge): number {
  return a.cell - b.cell || SIDE_ORDER[a.side] - SIDE_ORDER[b.side];
}
