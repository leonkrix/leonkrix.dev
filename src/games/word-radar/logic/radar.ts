import { DIMENSIONS, vectorOf, type WordData } from './data';
import { principalPlane } from './map';

/** How close a guess is, in words. Colors and a label say it, never the color alone. */
export interface Bucket {
  id: 'found' | 'burning' | 'hot' | 'warm' | 'cool' | 'cold';
  label: string;
  /** The highest rank that still belongs to this bucket */
  upTo: number;
}

const coldest: Bucket = { id: 'cold', label: 'Cold', upTo: Number.POSITIVE_INFINITY };

export const buckets: readonly Bucket[] = [
  { id: 'found', label: 'Found it', upTo: 1 },
  { id: 'burning', label: 'Burning', upTo: 10 },
  { id: 'hot', label: 'Hot', upTo: 100 },
  { id: 'warm', label: 'Warm', upTo: 1000 },
  { id: 'cool', label: 'Cool', upTo: 5000 },
  coldest,
];

export function bucketOf(rank: number): Bucket {
  return buckets.find((bucket) => rank <= bucket.upTo) ?? coldest;
}

/**
 * How far from the middle of the radar a word is, from 0 (the hidden word) to 1 (the farthest of
 * the list). A logarithm of the rank, so that the ranks that matter (1 to 1,000) get most of the
 * space and the thousands of far words are squeezed to the edge.
 */
export function radiusOf(rank: number, size: number): number {
  return Math.log(Math.max(rank, 1)) / Math.log(Math.max(size, 2));
}

/** How full the bar of a guess is, from 1 (the hidden word) down to nearly 0. */
export function closenessOf(rank: number, size: number): number {
  return 1 - radiusOf(rank, size);
}

/** How many of the nearest words decide the plane of the radar */
const NEIGHBORHOOD = 300;

/**
 * The plane of the radar: the two directions in which the nearest words of the hidden word differ
 * most (a principal component analysis of the nearest 300). It is made once per round and does not
 * change while you play, so a dot keeps its direction. Words that are related to the hidden word
 * in similar ways tend to lie in similar directions, and so near each other.
 */
export function radarPlane(
  data: WordData,
  order: Uint32Array,
): readonly [Float64Array, Float64Array] {
  const plane = principalPlane(data, Array.from(order.subarray(0, NEIGHBORHOOD + 1)));
  if (plane === null) {
    throw new Error('There are no words to make a radar from');
  }
  return [plane.first, plane.second];
}

/**
 * The angle of a word around the radar, in radians, counted clockwise from the east. It is the
 * direction of the difference between the word and the hidden word, seen on the plane of the
 * radar: words that differ from the hidden word in the same way lie in the same direction.
 */
export function angleOf(
  data: WordData,
  secret: number,
  index: number,
  plane: readonly [Float64Array, Float64Array],
): number {
  const word = vectorOf(data, index);
  const hidden = vectorOf(data, secret);
  let x = 0;
  let y = 0;
  for (let dimension = 0; dimension < DIMENSIONS; dimension += 1) {
    const difference = (word[dimension] ?? 0) - (hidden[dimension] ?? 0);
    x += difference * (plane[0][dimension] ?? 0);
    y += difference * (plane[1][dimension] ?? 0);
  }
  return Math.atan2(y, x);
}
