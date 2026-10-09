import { type Cell, type KindInfo, type Layout, type Side } from './types';

const OFFSETS: Record<Side, readonly [number, number]> = {
  n: [-1, 0],
  s: [1, 0],
  w: [0, -1],
  e: [0, 1],
};

export const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];

/**
 * A layout with everything the rules ask about it worked out once: where a cell is, what lies on
 * it, which cells touch a wall or a window, and who its neighbors are. Nothing here changes.
 */
export class Board {
  readonly size: number;
  readonly cellCount: number;
  readonly roomOf: readonly number[];
  readonly roomCount: number;
  readonly roomCells: readonly (readonly Cell[])[];
  /** The kind of object that lies on a cell, if any */
  readonly kindAt: readonly (string | undefined)[];
  /** Cells that nobody can stand on: they hold an object that is not occupiable */
  readonly blocked: ReadonlySet<Cell>;
  /** Cells that have a window on one of their sides, or lie across from one */
  readonly windowCells: ReadonlySet<Cell>;
  /** Cells with a wall on at least one side: the board edge or a room boundary */
  readonly wallCells: ReadonlySet<Cell>;
  /** The cells next to a cell, above, below, left and right, in the same room only */
  readonly roomNeighbors: readonly (readonly Cell[])[];
  /** The type of every room, in the order of the room numbers */
  readonly roomType: readonly string[];
  /** Whether a room has a window on one of its cells */
  readonly roomHasWindow: readonly boolean[];
  /** The kinds of objects that lie in a room */
  readonly roomKinds: readonly ReadonlySet<string>[];
  /** The room with the most cells and the room with the fewest, if only one room has that size */
  readonly largestRoom: number | undefined;
  readonly smallestRoom: number | undefined;
  /** All cells that hold an object of a kind */
  readonly kindCells: ReadonlyMap<string, readonly Cell[]>;
  /** The number of the object (in the layout) on a cell, if any */
  readonly objectAt: readonly (number | undefined)[];
  /** How many objects there are of a kind */
  readonly objectCount: ReadonlyMap<string, number>;
  readonly layout: Layout;

  constructor(layout: Layout, kinds: Readonly<Record<string, KindInfo>>) {
    const { size } = layout;
    this.layout = layout;
    this.size = size;
    this.cellCount = size * size;
    this.roomOf = layout.roomOf;
    this.roomCount = layout.roomCount;

    const roomCells: Cell[][] = Array.from({ length: layout.roomCount }, () => []);
    layout.roomOf.forEach((room, cell) => {
      roomCells[room]?.push(cell);
    });
    this.roomCells = roomCells;

    const kindAt: (string | undefined)[] = Array.from({ length: this.cellCount });
    const blocked = new Set<Cell>();
    for (const object of layout.objects) {
      for (const cell of object.cells) {
        kindAt[cell] = object.kind;
        if (kinds[object.kind]?.occupiable !== true) {
          blocked.add(cell);
        }
      }
    }
    this.kindAt = kindAt;
    this.blocked = blocked;

    const objectAt: (number | undefined)[] = Array.from({ length: this.cellCount });
    const kindCells = new Map<string, Cell[]>();
    const objectCount = new Map<string, number>();
    layout.objects.forEach((object, index) => {
      objectCount.set(object.kind, (objectCount.get(object.kind) ?? 0) + 1);
      for (const cell of object.cells) {
        objectAt[cell] = index;
        kindCells.set(object.kind, [...(kindCells.get(object.kind) ?? []), cell]);
      }
    });
    this.objectAt = objectAt;
    this.kindCells = kindCells;
    this.objectCount = objectCount;

    const windowCells = new Set<Cell>();
    for (const { cell, side } of layout.windows) {
      windowCells.add(cell);
      const across = this.step(cell, side);
      if (across !== undefined) {
        windowCells.add(across);
      }
    }
    this.windowCells = windowCells;

    this.roomType = layout.rooms.map((room) => room.type);
    this.roomHasWindow = roomCells.map((cells) => cells.some((cell) => windowCells.has(cell)));
    this.roomKinds = roomCells.map(
      (cells) =>
        new Set(cells.flatMap((cell) => (kindAt[cell] === undefined ? [] : [kindAt[cell] ?? '']))),
    );
    const sizes = roomCells.map((cells) => cells.length);
    const most = Math.max(...sizes);
    const fewest = Math.min(...sizes);
    this.largestRoom =
      sizes.filter((count) => count === most).length === 1 ? sizes.indexOf(most) : undefined;
    this.smallestRoom =
      sizes.filter((count) => count === fewest).length === 1 ? sizes.indexOf(fewest) : undefined;

    const wallCells = new Set<Cell>();
    const roomNeighbors: Cell[][] = Array.from({ length: this.cellCount }, () => []);
    for (let cell = 0; cell < this.cellCount; cell += 1) {
      for (const side of SIDES) {
        const next = this.step(cell, side);
        if (next === undefined || layout.roomOf[next] !== layout.roomOf[cell]) {
          wallCells.add(cell);
        } else {
          roomNeighbors[cell]?.push(next);
        }
      }
    }
    this.wallCells = wallCells;
    this.roomNeighbors = roomNeighbors;
  }

  row(cell: Cell): number {
    return Math.floor(cell / this.size);
  }

  col(cell: Cell): number {
    return cell % this.size;
  }

  cellAt(row: number, col: number): Cell {
    return row * this.size + col;
  }

  /** The cell next to this one on the given side, or nothing at the edge of the board */
  step(cell: Cell, side: Side): Cell | undefined {
    const [dRow, dCol] = OFFSETS[side];
    const row = this.row(cell) + dRow;
    const col = this.col(cell) + dCol;
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) {
      return undefined;
    }
    return this.cellAt(row, col);
  }

  isCorner(cell: Cell): boolean {
    const last = this.size - 1;
    return (
      (this.row(cell) === 0 || this.row(cell) === last) &&
      (this.col(cell) === 0 || this.col(cell) === last)
    );
  }
}
