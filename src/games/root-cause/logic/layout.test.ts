import { describe, expect, it } from 'vitest';

import { createRandom } from '../../shared/random';
import { caseFile, outage } from '../data/skins';
import { Board } from './board';
import { generateLayout, roomCountFor, roomCountRange, SIZES } from './layout';
import { kindsOf, type Skin } from './skin';
import { type Layout, type Tier } from './types';

const TIERS: readonly Tier[] = ['easy', 'medium', 'hard'];
const SKINS: readonly Skin[] = [caseFile, outage];

describe('the number of rooms', () => {
  it('has a lower and a generous upper limit that grow with the board', () => {
    expect(SIZES).toEqual([4, 5, 6, 7, 8, 9]);
    const ranges = SIZES.map((size) => roomCountRange(size));
    expect(ranges).toEqual([
      [2, 4],
      [2, 5],
      [3, 7],
      [3, 8],
      [4, 9],
      [4, 9],
    ]);
  });

  it('stays inside the limits and can reach every count, for every tier', () => {
    for (const size of SIZES) {
      const [low, high] = roomCountRange(size);
      for (const tier of TIERS) {
        const random = createRandom(`rooms-${String(size)}-${tier}`);
        const seen = new Set(Array.from({ length: 400 }, () => roomCountFor(size, tier, random)));
        for (const count of seen) {
          expect(count).toBeGreaterThanOrEqual(low);
          expect(count).toBeLessThanOrEqual(high);
        }
        // Nothing is ruled out: an easy 6 by 6 can have five rooms, a hard one too
        expect([...seen].sort()).toEqual(
          Array.from({ length: high - low + 1 }, (_, index) => low + index),
        );
      }
    }
  });

  it('leans towards more rooms on easy levels and fewer on hard levels', () => {
    for (const size of [6, 8, 9]) {
      const average = (tier: Tier): number => {
        const random = createRandom(`lean-${String(size)}-${tier}`);
        const counts = Array.from({ length: 600 }, () => roomCountFor(size, tier, random));
        return counts.reduce((sum, count) => sum + count, 0) / counts.length;
      };
      expect(average('easy')).toBeGreaterThan(average('medium'));
      expect(average('medium')).toBeGreaterThan(average('hard'));
    }
  });

  it('refuses a size that has no layout', () => {
    expect(() => roomCountFor(3, 'easy', createRandom(1))).toThrow(RangeError);
    expect(() => roomCountRange(10)).toThrow(RangeError);
  });
});

function cellsOf(board: Board, room: number): number[] {
  return [...(board.roomCells[room] ?? [])];
}

function boxOf(board: Board, cells: readonly number[]): [number, number] {
  const rows = cells.map((cell) => board.row(cell));
  const cols = cells.map((cell) => board.col(cell));
  return [Math.max(...rows) - Math.min(...rows) + 1, Math.max(...cols) - Math.min(...cols) + 1];
}

/** A room that is a straight strip of at least three cells */
function isStrip(board: Board, room: number): boolean {
  const cells = cellsOf(board, room);
  const [height, width] = boxOf(board, cells);
  return Math.min(height, width) === 1 && cells.length >= 3;
}

describe.each(SKINS)('generateLayout for $id', (skin) => {
  const cases = SIZES.flatMap((size) => TIERS.map((tier) => ({ size, tier })));
  const make = (size: number, tier: Tier, seed: number): Layout =>
    generateLayout(
      skin,
      size,
      tier,
      createRandom(`${skin.id}-${String(size)}-${tier}-${String(seed)}`),
    );

  it.each(cases)('makes a sound map for $size by $size, $tier', ({ size, tier }) => {
    for (let seed = 0; seed < 20; seed += 1) {
      const layout = make(size, tier, seed);
      const board = new Board(layout, kindsOf(skin));
      const where = `seed ${String(seed)}`;
      const [low, high] = roomCountRange(size);

      // Rooms: all cells belong to a room, every room has at least two cells and is connected
      expect(layout.roomOf, where).toHaveLength(size * size);
      expect(layout.roomCount, where).toBeGreaterThanOrEqual(low);
      expect(layout.roomCount, where).toBeLessThanOrEqual(high);
      expect(new Set(layout.roomOf).size, where).toBe(layout.roomCount);
      for (let room = 0; room < layout.roomCount; room += 1) {
        const cells = cellsOf(board, room);
        expect(cells.length, where).toBeGreaterThanOrEqual(2);
        const seen = new Set<number>([cells[0] ?? 0]);
        const queue = [cells[0] ?? 0];
        while (queue.length > 0) {
          for (const next of board.roomNeighbors[queue.pop() ?? 0] ?? []) {
            if (!seen.has(next)) {
              seen.add(next);
              queue.push(next);
            }
          }
        }
        expect(seen.size, `${where}: a room is in pieces`).toBe(cells.length);
      }

      // Windows: on walls, none twice
      expect(layout.windows.length, where).toBeGreaterThanOrEqual(1);
      const seenWindows = new Set<string>();
      for (const { cell, side } of layout.windows) {
        const across = board.step(cell, side);
        expect(across === undefined || board.roomOf[across] !== board.roomOf[cell], where).toBe(
          true,
        );
        expect(seenWindows.has(`${String(cell)}${side}`), where).toBe(false);
        seenWindows.add(`${String(cell)}${side}`);
      }

      // Objects: each cell holds at most one, two-cell objects are neighbors in one room
      const covered = layout.objects.flatMap((object) => object.cells);
      expect(new Set(covered).size, where).toBe(covered.length);
      for (const object of layout.objects) {
        expect(skin.kinds[object.kind], where).toBeDefined();
        expect(object.cells).toHaveLength(skin.kinds[object.kind]?.cells ?? 0);
        if (object.cells.length === 2) {
          const [first = 0, second = 0] = object.cells;
          expect(board.roomNeighbors[first], where).toContain(second);
        }
      }

      // Enough room to stand: every row, column and room has cells that are not blocked
      for (let index = 0; index < size; index += 1) {
        const row = Array.from({ length: size }, (_, col) => board.cellAt(index, col));
        const col = Array.from({ length: size }, (_, r) => board.cellAt(r, index));
        expect(row.filter((cell) => !board.blocked.has(cell)).length, where).toBeGreaterThanOrEqual(
          2,
        );
        expect(col.filter((cell) => !board.blocked.has(cell)).length, where).toBeGreaterThanOrEqual(
          2,
        );
      }
      for (const cells of board.roomCells) {
        expect(
          cells.some((cell) => !board.blocked.has(cell)),
          where,
        ).toBe(true);
      }
    }
  });

  it('gives every room a type of the skin and a name, numbered when a type appears twice', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const layout = make(7, 'medium', seed);
      const names = layout.rooms.map((room) => room.name);
      expect(layout.rooms).toHaveLength(layout.roomCount);
      expect(new Set(names).size).toBe(names.length);
      const counts = new Map<string, number>();
      for (const room of layout.rooms) {
        const type = skin.roomTypes.find((entry) => entry.id === room.type);
        expect(type, room.type).toBeDefined();
        counts.set(room.type, (counts.get(room.type) ?? 0) + 1);
      }
      for (const room of layout.rooms) {
        const type = skin.roomTypes.find((entry) => entry.id === room.type);
        const several = (counts.get(room.type) ?? 0) > 1;
        // A type that appears once is called by its name, one that appears twice is numbered
        expect(room.name).toMatch(
          several ? new RegExp(`^${type?.name ?? ''} \\d+$`) : new RegExp(`^${type?.name ?? ''}$`),
        );
      }
    }
  });

  it('allows several rooms of the same type on one map', () => {
    const doubled = Array.from({ length: 60 }, (_, seed) => make(8, 'easy', seed)).filter(
      (layout) => new Set(layout.rooms.map((room) => room.type)).size < layout.rooms.length,
    );
    expect(doubled.length).toBeGreaterThan(10);
  });

  it('has a corridor on some maps, never more than one, and no other room is a strip', () => {
    let withCorridor = 0;
    for (let seed = 0; seed < 120; seed += 1) {
      const layout = make(7, 'medium', seed);
      const board = new Board(layout, kindsOf(skin));
      const corridors = layout.rooms.flatMap((room, index) =>
        skin.roomTypes.find((type) => type.id === room.type)?.corridor === true ? [index] : [],
      );
      expect(corridors.length).toBeLessThanOrEqual(1);
      withCorridor += corridors.length;
      for (let room = 0; room < layout.roomCount; room += 1) {
        if (corridors.includes(room)) {
          expect(isStrip(board, room), 'a corridor is a strip').toBe(true);
        } else {
          expect(
            isStrip(board, room),
            `seed ${String(seed)}: room ${String(room)} is a strip`,
          ).toBe(false);
        }
      }
    }
    // About one map in three, but not all and not none
    expect(withCorridor).toBeGreaterThan(15);
    expect(withCorridor).toBeLessThan(80);
  });

  it('makes rooms that are compact: they fill most of the box around them', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const layout = make(8, 'hard', seed);
      const board = new Board(layout, kindsOf(skin));
      layout.rooms.forEach((room, index) => {
        const cells = cellsOf(board, index);
        const [height, width] = boxOf(board, cells);
        const isCorridor = skin.roomTypes.find((type) => type.id === room.type)?.corridor === true;
        if (!isCorridor) {
          expect(
            cells.length / (height * width),
            `seed ${String(seed)} room ${room.name}`,
          ).toBeGreaterThanOrEqual(0.55);
        }
      });
    }
  });

  it('puts objects where they fit: never an object with no affinity for the room', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const layout = make(7, 'easy', seed);
      for (const object of layout.objects) {
        for (const cell of object.cells) {
          const room = layout.rooms[layout.roomOf[cell] ?? 0];
          const type = skin.roomTypes.find((entry) => entry.id === room?.type);
          expect(
            type?.affinity[object.kind] ?? 0.3,
            `${object.kind} in ${room?.name ?? ''}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('can put several objects of the same kind into one room, for example two chairs in an office', () => {
    let rooms = 0;
    let withTwo = 0;
    for (let seed = 0; seed < 120; seed += 1) {
      const layout = make(7, 'easy', seed);
      const perRoom = new Map<string, number>();
      for (const object of layout.objects) {
        const key = `${String(layout.roomOf[object.cells[0] ?? 0])}:${object.kind}`;
        perRoom.set(key, (perRoom.get(key) ?? 0) + 1);
      }
      rooms += layout.roomCount;
      withTwo += [...perRoom.values()].filter((count) => count >= 2).length;
    }
    // It happens, but it is a choice of chance and not the rule
    expect(withTwo).toBeGreaterThan(20);
    expect(withTwo).toBeLessThan(rooms);
  });

  it('puts more places to stand on easy maps than on hard ones, of the same size', () => {
    const stand = (tier: Tier): number => {
      let total = 0;
      for (let seed = 0; seed < 40; seed += 1) {
        const layout = make(8, tier, seed);
        total += layout.objects.filter(
          (object) => skin.kinds[object.kind]?.occupiable === true,
        ).length;
      }
      return total;
    };
    expect(stand('easy')).toBeGreaterThan(stand('medium'));
    expect(stand('medium')).toBeGreaterThan(stand('hard'));
  });

  it('blocks more cells on easy maps and leaves more open floor on hard ones', () => {
    const blockedCells = (tier: Tier): number => {
      let total = 0;
      for (let seed = 0; seed < 40; seed += 1) {
        const layout = make(8, tier, seed);
        total += new Board(layout, kindsOf(skin)).blocked.size;
      }
      return total;
    };
    expect(blockedCells('easy')).toBeGreaterThan(blockedCells('medium'));
    expect(blockedCells('medium')).toBeGreaterThan(blockedCells('hard'));
  });

  it('makes the same plan for the same seed and a different one for another seed', () => {
    expect(make(6, 'medium', 1)).toEqual(make(6, 'medium', 1));
    expect(make(6, 'medium', 1)).not.toEqual(make(6, 'medium', 2));
  });
});
