import { DIMENSIONS, vectorOf, type WordData } from './data';

/** A direction found by power iteration: the strongest direction of the points around their mean. */
function strongestDirection(
  covariance: Float64Array,
  start: Float64Array,
  size: number,
): Float64Array {
  let direction = Float64Array.from(start);
  for (let step = 0; step < 100; step += 1) {
    const next = new Float64Array(size);
    for (let row = 0; row < size; row += 1) {
      let sum = 0;
      for (let column = 0; column < size; column += 1) {
        sum += (covariance[row * size + column] ?? 0) * (direction[column] ?? 0);
      }
      next[row] = sum;
    }
    const length = Math.hypot(...next);
    if (length < 1e-12) {
      return direction;
    }
    direction = next.map((value) => value / length);
  }
  return direction;
}

export interface Plane {
  mean: Float64Array;
  /** The direction in which the points differ most */
  first: Float64Array;
  /** The strongest direction that is left, at a right angle to the first */
  second: Float64Array;
}

/**
 * The plane of the points: the two directions in which they differ most (a principal component
 * analysis), found by power iteration. The same points always give the same plane. Null without points.
 */
export function principalPlane(data: WordData, indexes: readonly number[]): Plane | null {
  const count = indexes.length;
  if (count === 0) {
    return null;
  }
  const rows = indexes.map((index) => vectorOf(data, index));
  const mean = new Float64Array(DIMENSIONS);
  for (const row of rows) {
    for (let dimension = 0; dimension < DIMENSIONS; dimension += 1) {
      mean[dimension] = (mean[dimension] ?? 0) + (row[dimension] ?? 0) / count;
    }
  }
  const covariance = new Float64Array(DIMENSIONS * DIMENSIONS);
  const centered = new Float64Array(DIMENSIONS);
  for (const row of rows) {
    for (let dimension = 0; dimension < DIMENSIONS; dimension += 1) {
      centered[dimension] = (row[dimension] ?? 0) - (mean[dimension] ?? 0);
    }
    for (let x = 0; x < DIMENSIONS; x += 1) {
      for (let y = 0; y < DIMENSIONS; y += 1) {
        covariance[x * DIMENSIONS + y] =
          (covariance[x * DIMENSIONS + y] ?? 0) + (centered[x] ?? 0) * (centered[y] ?? 0);
      }
    }
  }
  // The same start every time, so that the same points always give the same plane
  const first = strongestDirection(
    covariance,
    Float64Array.from({ length: DIMENSIONS }, (_, index) => Math.sin(index + 1)),
    DIMENSIONS,
  );
  // Take the first direction out of the matrix, then the strongest one that is left is the second
  let strength = 0;
  for (let x = 0; x < DIMENSIONS; x += 1) {
    for (let y = 0; y < DIMENSIONS; y += 1) {
      strength += (first[x] ?? 0) * (covariance[x * DIMENSIONS + y] ?? 0) * (first[y] ?? 0);
    }
  }
  const rest = Float64Array.from(covariance);
  for (let x = 0; x < DIMENSIONS; x += 1) {
    for (let y = 0; y < DIMENSIONS; y += 1) {
      rest[x * DIMENSIONS + y] =
        (rest[x * DIMENSIONS + y] ?? 0) - strength * (first[x] ?? 0) * (first[y] ?? 0);
    }
  }
  const second = strongestDirection(
    rest,
    Float64Array.from({ length: DIMENSIONS }, (_, index) => Math.cos(index + 2)),
    DIMENSIONS,
  );
  return { mean, first, second };
}

/**
 * Flattens points of the word space onto their plane (see `principalPlane`). Returns coordinates
 * that fit into a square from -1 to 1. This is the map shown after a round.
 */
export function flatten(data: WordData, indexes: readonly number[]): [number, number][] {
  const plane = principalPlane(data, indexes);
  if (plane === null) {
    return [];
  }
  const project = (index: number, direction: Float64Array): number => {
    const row = vectorOf(data, index);
    let sum = 0;
    for (let dimension = 0; dimension < DIMENSIONS; dimension += 1) {
      sum += ((row[dimension] ?? 0) - (plane.mean[dimension] ?? 0)) * (direction[dimension] ?? 0);
    }
    return sum;
  };
  const points = indexes.map((index): [number, number] => [
    project(index, plane.first),
    project(index, plane.second),
  ]);
  const extent = Math.max(1e-9, ...points.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]));
  return points.map(([x, y]) => [x / extent, y / extent]);
}
