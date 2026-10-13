/**
 * Principal component analysis for the data of Word Radar, in plain TypeScript (no dependencies).
 * It is used once, by `build-data.ts`, to shrink the 100 dimensions of the GloVe vectors to 64.
 */

/** The average of the rows. */
export function meanOf(rows: readonly Float32Array[]): Float64Array {
  const first = rows[0];
  if (first === undefined) {
    throw new RangeError('meanOf needs at least one row');
  }
  const mean = new Float64Array(first.length);
  for (const row of rows) {
    for (let index = 0; index < mean.length; index += 1) {
      mean[index] = (mean[index] ?? 0) + (row[index] ?? 0);
    }
  }
  for (let index = 0; index < mean.length; index += 1) {
    mean[index] = (mean[index] ?? 0) / rows.length;
  }
  return mean;
}

/** The covariance matrix (dimensions by dimensions, row by row) of rows around their mean. */
export function covariance(rows: readonly Float32Array[], mean: Float64Array): Float64Array {
  const size = mean.length;
  const matrix = new Float64Array(size * size);
  const centered = new Float64Array(size);
  for (const row of rows) {
    for (let index = 0; index < size; index += 1) {
      centered[index] = (row[index] ?? 0) - (mean[index] ?? 0);
    }
    for (let a = 0; a < size; a += 1) {
      const valueA = centered[a] ?? 0;
      for (let b = a; b < size; b += 1) {
        matrix[a * size + b] = (matrix[a * size + b] ?? 0) + valueA * (centered[b] ?? 0);
      }
    }
  }
  for (let a = 0; a < size; a += 1) {
    for (let b = a; b < size; b += 1) {
      const value = (matrix[a * size + b] ?? 0) / Math.max(rows.length - 1, 1);
      matrix[a * size + b] = value;
      matrix[b * size + a] = value;
    }
  }
  return matrix;
}

export interface Eigen {
  /** Largest first */
  values: Float64Array;
  /** `vectors[i]` belongs to `values[i]` and has length 1 */
  vectors: Float64Array[];
}

/**
 * The eigenvalues and eigenvectors of a symmetric matrix, by cyclic Jacobi rotations. Slow for big
 * matrices but exact and simple, and a covariance matrix of 100 by 100 takes about a second.
 */
export function jacobiEigen(symmetric: Float64Array, size: number): Eigen {
  const matrix = Float64Array.from(symmetric);
  const vectors = new Float64Array(size * size);
  for (let index = 0; index < size; index += 1) {
    vectors[index * size + index] = 1;
  }
  for (let sweep = 0; sweep < 60; sweep += 1) {
    let off = 0;
    for (let a = 0; a < size; a += 1) {
      for (let b = a + 1; b < size; b += 1) {
        off += (matrix[a * size + b] ?? 0) ** 2;
      }
    }
    if (off < 1e-22) {
      break;
    }
    for (let p = 0; p < size; p += 1) {
      for (let q = p + 1; q < size; q += 1) {
        const apq = matrix[p * size + q] ?? 0;
        if (Math.abs(apq) < 1e-300) {
          continue;
        }
        const app = matrix[p * size + p] ?? 0;
        const aqq = matrix[q * size + q] ?? 0;
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < size; k += 1) {
          const akp = matrix[k * size + p] ?? 0;
          const akq = matrix[k * size + q] ?? 0;
          matrix[k * size + p] = c * akp - s * akq;
          matrix[k * size + q] = s * akp + c * akq;
        }
        for (let k = 0; k < size; k += 1) {
          const apk = matrix[p * size + k] ?? 0;
          const aqk = matrix[q * size + k] ?? 0;
          matrix[p * size + k] = c * apk - s * aqk;
          matrix[q * size + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < size; k += 1) {
          const vkp = vectors[k * size + p] ?? 0;
          const vkq = vectors[k * size + q] ?? 0;
          vectors[k * size + p] = c * vkp - s * vkq;
          vectors[k * size + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: size }, (_, index) => index).sort(
    (a, b) => (matrix[b * size + b] ?? 0) - (matrix[a * size + a] ?? 0),
  );
  return {
    values: Float64Array.from(order, (index) => matrix[index * size + index] ?? 0),
    vectors: order.map((column) =>
      Float64Array.from({ length: size }, (_, row) => vectors[row * size + column] ?? 0),
    ),
  };
}

export interface Projection {
  mean: Float64Array;
  /** The kept directions, strongest first */
  components: Float64Array[];
  /** The share of the variance that each kept direction explains */
  explained: number[];
}

/** The `count` strongest directions of the rows. */
export function fitPca(rows: readonly Float32Array[], count: number): Projection {
  const mean = meanOf(rows);
  const size = mean.length;
  const eigen = jacobiEigen(covariance(rows, mean), size);
  const total = eigen.values.reduce((sum, value) => sum + Math.max(value, 0), 0);
  return {
    mean,
    components: eigen.vectors.slice(0, count),
    explained: Array.from(eigen.values.slice(0, count), (value) => Math.max(value, 0) / total),
  };
}

/** One row in the new coordinates. */
export function project(row: Float32Array, projection: Projection): Float64Array {
  return Float64Array.from(projection.components, (component) => {
    let sum = 0;
    for (let index = 0; index < component.length; index += 1) {
      sum += ((row[index] ?? 0) - (projection.mean[index] ?? 0)) * (component[index] ?? 0);
    }
    return sum;
  });
}

/** The same direction with the length 1 (a zero vector stays zero). */
export function normalize(vector: Float64Array): Float64Array {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  const length = Math.sqrt(sum);
  return length === 0 ? vector : vector.map((value) => value / length);
}

/** A vector of length 1 as whole numbers from -127 to 127. */
export function quantize(unit: Float64Array): Int8Array {
  return Int8Array.from(unit, (value) => Math.max(-127, Math.min(127, Math.round(value * 127))));
}
