import { describe, expect, it } from 'vitest';

import { covariance, fitPca, jacobiEigen, meanOf, normalize, project, quantize } from './pca';

/** Points on a tilted line, with a little spread across it. */
function tiltedPoints(count: number): Float32Array[] {
  return Array.from({ length: count }, (_, index) => {
    const along = (index - count / 2) / 10;
    const across = ((index * 7) % 5) / 100;
    // Direction (3, 4, 0) / 5 and a small wobble along the second axis (-4, 3, 0) / 5
    return Float32Array.from([
      (3 * along - 4 * across) / 5 + 2,
      (4 * along + 3 * across) / 5 - 1,
      0.5,
    ]);
  });
}

describe('the principal component analysis', () => {
  it('finds the mean and the covariance', () => {
    const rows = [Float32Array.from([1, 2]), Float32Array.from([3, 6])];
    const mean = meanOf(rows);
    expect([...mean]).toEqual([2, 4]);
    expect([...covariance(rows, mean)]).toEqual([2, 4, 4, 8]);
  });

  it('finds the eigenvalues and eigenvectors of a symmetric matrix', () => {
    // [[2, 1], [1, 2]] has the eigenvalues 3 and 1, with the directions (1, 1) and (1, -1)
    const eigen = jacobiEigen(Float64Array.from([2, 1, 1, 2]), 2);
    expect(eigen.values[0]).toBeCloseTo(3, 10);
    expect(eigen.values[1]).toBeCloseTo(1, 10);
    const [first] = eigen.vectors;
    expect(Math.abs(first?.[0] ?? 0)).toBeCloseTo(Math.SQRT1_2, 10);
    expect(Math.abs(first?.[1] ?? 0)).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('puts the strongest direction first, and keeps almost all the variation of a line', () => {
    const rows = tiltedPoints(200);
    const projection = fitPca(rows, 2);
    const [main] = projection.components;
    expect(Math.abs(main?.[0] ?? 0)).toBeCloseTo(0.6, 2);
    expect(Math.abs(main?.[1] ?? 0)).toBeCloseTo(0.8, 2);
    expect(projection.explained[0]).toBeGreaterThan(0.99);
    // The components are unit vectors that stand at right angles
    const [first, second] = projection.components;
    const dot = Array.from(first ?? new Float64Array()).reduce<number>(
      (sum, value, index) => sum + value * (second?.[index] ?? 0),
      0,
    );
    expect(dot).toBeCloseTo(0, 8);
  });

  it('keeps the distances between points when no direction is dropped', () => {
    const rows = tiltedPoints(30);
    const projection = fitPca(rows, 3);
    const [a, b] = [rows[0], rows[17]];
    if (a === undefined || b === undefined) {
      throw new Error('no rows');
    }
    const flat = (row: Float32Array): number[] => [...project(row, projection)];
    const distance = (x: number[], y: number[]): number =>
      Math.hypot(...x.map((value, index) => value - (y[index] ?? 0)));
    const before = Math.hypot(...[...a].map((value, index) => value - (b[index] ?? 0)));
    expect(distance(flat(a), flat(b))).toBeCloseTo(before, 5);
  });

  it('makes unit vectors and whole numbers from -127 to 127', () => {
    const unit = normalize(Float64Array.from([3, 4]));
    expect([...unit]).toEqual([0.6, 0.8]);
    expect([...quantize(unit)]).toEqual([76, 102]);
    expect([...quantize(Float64Array.from([-1, 1, 0]))]).toEqual([-127, 127, 0]);
    expect([...normalize(Float64Array.from([0, 0]))]).toEqual([0, 0]);
  });
});
