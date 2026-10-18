import type { Random } from '../../shared/random';
import type { Point } from './geometry';

/**
 * Where the nodes of a generated level stand. Every node is on a lattice, so nodes in a row share
 * their height and nodes in a column share their place from left to right, which makes a map look
 * ordered. The four families choose different cells: a filled grid, the border of a rectangle (a
 * ring), a hub with its neighbours around it, and a random cluster. Variety comes from the choice of
 * cells and from the size of the lattice; the drawing rules (`geometry.ts`) still decide which
 * cables are possible.
 */

export type LatticeFamily = 'grid' | 'ring' | 'hub' | 'mesh';

interface Cell {
  column: number;
  row: number;
}

/** The place of a cell in the units of a level (the y is squeezed later, see `mapPoint`). */
function pointOfCell(cell: Cell, columns: number, rows: number): Point {
  return {
    x: 10 + (cell.column * 80) / Math.max(1, columns - 1),
    y: 12 + (cell.row * 76) / Math.max(1, rows - 1),
  };
}

function shuffled<T>(random: Random, items: readonly T[]): T[] {
  return random.shuffle(items);
}

function gridCells(
  count: number,
  random: Random,
): { cells: Cell[]; columns: number; rows: number } {
  const columns = Math.min(
    5,
    Math.max(3, Math.ceil(Math.sqrt(count * 1.7)) + (random.next() < 0.3 ? 1 : 0)),
  );
  const rows = Math.min(4, Math.max(2, Math.ceil(count / columns)));
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row += 1) {
    const inRow = row === rows - 1 ? count - cells.length : Math.min(columns, count - cells.length);
    const width = Math.min(columns, inRow);
    // A row that is not full is centered, so the picture stays balanced
    const start = Math.floor((columns - width) / 2);
    for (let at = 0; at < width; at += 1) {
      cells.push({ column: start + at, row });
    }
  }
  return { cells, columns, rows };
}

function ringCells(
  count: number,
  random: Random,
): { cells: Cell[]; columns: number; rows: number } {
  const shapes: { columns: number; rows: number }[] = [];
  for (let columns = 3; columns <= 5; columns += 1) {
    for (let rows = 2; rows <= 4; rows += 1) {
      const border = 2 * columns + 2 * rows - 4;
      if (border >= count && border <= count + 2) {
        shapes.push({ columns, rows });
      }
    }
  }
  const shape = random.pick(shapes.length > 0 ? shapes : [{ columns: 5, rows: 4 }]);
  const border: Cell[] = [];
  for (let column = 0; column < shape.columns; column += 1) {
    border.push({ column, row: 0 });
  }
  for (let row = 1; row < shape.rows; row += 1) {
    border.push({ column: shape.columns - 1, row });
  }
  for (let column = shape.columns - 2; column >= 0; column -= 1) {
    border.push({ column, row: shape.rows - 1 });
  }
  for (let row = shape.rows - 2; row >= 1; row -= 1) {
    border.push({ column: 0, row });
  }
  // Fewer nodes than the border has: leave out some that are not corners
  const removable = shuffled(
    random,
    border.filter((cell) =>
      cell.column > 0 && cell.column < shape.columns - 1
        ? true
        : cell.row > 0 && cell.row < shape.rows - 1,
    ),
  );
  const drop = new Set(
    removable
      .slice(0, Math.max(0, border.length - count))
      .map((cell) => `${String(cell.column)},${String(cell.row)}`),
  );
  return {
    cells: border.filter((cell) => !drop.has(`${String(cell.column)},${String(cell.row)}`)),
    ...shape,
  };
}

function hubCells(count: number, random: Random): { cells: Cell[]; columns: number; rows: number } {
  const columns = 5;
  const rows = count <= 9 ? 3 : 4;
  const center: Cell = { column: 2, row: 1 };
  const all: Cell[] = [];
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      all.push({ column, row });
    }
  }
  const nearest = shuffled(random, all).sort(
    (a, b) =>
      Math.hypot(a.column - center.column, (a.row - center.row) * 0.75) -
      Math.hypot(b.column - center.column, (b.row - center.row) * 0.75),
  );
  return { cells: nearest.slice(0, count), columns, rows };
}

function meshCells(
  count: number,
  random: Random,
): { cells: Cell[]; columns: number; rows: number } {
  const columns = 5;
  const rows = count <= 8 ? 3 : 4;
  const chosen: Cell[] = [{ column: random.int(columns), row: random.int(rows) }];
  const has = (cell: Cell): boolean =>
    chosen.some((other) => other.column === cell.column && other.row === cell.row);
  while (chosen.length < count) {
    const frontier: Cell[] = [];
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const cell = { column, row };
        const close = chosen.some(
          (other) => Math.max(Math.abs(other.column - column), Math.abs(other.row - row)) <= 2,
        );
        if (close && !has(cell)) {
          frontier.push(cell);
        }
      }
    }
    chosen.push(random.pick(frontier));
  }
  return { cells: chosen, columns, rows };
}

/** The points for `count` nodes in the units of a level. */
export function latticePoints(family: LatticeFamily, count: number, random: Random): Point[] {
  const { cells, columns, rows } =
    family === 'grid'
      ? gridCells(count, random)
      : family === 'ring'
        ? ringCells(count, random)
        : family === 'hub'
          ? hubCells(count, random)
          : meshCells(count, random);
  return cells.map((cell) => pointOfCell(cell, columns, rows));
}
