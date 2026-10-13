import { describe, expect, it } from 'vitest';

import { decodeVectors, DIMENSIONS, makeWordData, parseWordList, type WordData } from './data';
import { buildRoundUrl, parseSeed } from './link';
import { flatten } from './map';
import { angleOf, bucketOf, closenessOf, radarPlane, radiusOf } from './radar';
import {
  bestRank,
  giveUp,
  guessWord,
  nearestWords,
  normalizeGuess,
  pickSecret,
  startRound,
  takeHint,
} from './round';
import { rankWords, similarityTo } from './similarity';

/** Words made of three directions (fruit, vehicle, animal) and a little of a fourth. */
const sample: Record<string, number[]> = {
  apple: [100, 0, 0, 10],
  banana: [90, 10, 0, 20],
  pear: [95, 5, 5, 0],
  car: [0, 100, 0, 5],
  truck: [10, 90, 0, 15],
  bus: [5, 95, 10, 0],
  dog: [0, 0, 100, 10],
  cat: [10, 0, 90, 20],
  wolf: [0, 5, 95, 0],
};

function fixture(): WordData {
  const words = Object.keys(sample);
  const bytes = new Int8Array(words.length * DIMENSIONS);
  for (const [position, word] of words.entries()) {
    bytes.set(sample[word] ?? [], position * DIMENSIONS);
  }
  return makeWordData(`${words.join('\n')}\n`, bytes, 'apple\ncar\ndog\n');
}

const data = fixture();
const at = (word: string): number => data.indexOf.get(word) ?? -1;

describe('the data of the words', () => {
  it('reads one word per line', () => {
    expect(parseWordList('a\nb\n\nc\n')).toEqual(['a', 'b', 'c']);
  });

  it('makes every vector one unit long', () => {
    const vectors = decodeVectors(
      Int8Array.from({ length: DIMENSIONS * 2 }, (_, i) => (i % 7) + 1),
      2,
    );
    for (const word of [0, 1]) {
      let sum = 0;
      for (let index = 0; index < DIMENSIONS; index += 1) {
        sum += (vectors[word * DIMENSIONS + index] ?? 0) ** 2;
      }
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('refuses numbers that do not fit the words, and a hidden word that is not in the list', () => {
    expect(() => decodeVectors(new Int8Array(10), 2)).toThrow('Expected');
    expect(() => makeWordData('a\n', new Int8Array(DIMENSIONS), 'b\n')).toThrow(
      'not in the word list',
    );
  });
});

describe('closeness', () => {
  it('is 1 for a word and itself, and larger for words that mean nearly the same', () => {
    const sims = similarityTo(data, at('apple'));
    expect(sims[at('apple')]).toBeCloseTo(1, 5);
    expect(sims[at('banana')] ?? 0).toBeGreaterThan(sims[at('car')] ?? 1);
    expect(sims[at('pear')] ?? 0).toBeGreaterThan(sims[at('dog')] ?? 1);
  });

  it('ranks the hidden word first and the rest by similarity, every position once', () => {
    const ranking = rankWords(data, at('apple'));
    expect(ranking.rankOf[at('apple')]).toBe(1);
    expect(ranking.order[0]).toBe(at('apple'));
    expect(new Set(ranking.rankOf).size).toBe(data.words.length);
    expect(ranking.rankOf[at('pear')] ?? 99).toBeLessThan(ranking.rankOf[at('car')] ?? 0);
  });
});

describe('a round', () => {
  const secret = at('apple');

  it('picks the same hidden word for the same seed', () => {
    expect(pickSecret(data, 7)).toBe(pickSecret(data, 7));
    expect(data.secrets).toContain(pickSecret(data, 123456));
  });

  it('normalizes what was typed', () => {
    expect(normalizeGuess('  Apple ')).toBe('apple');
    expect(normalizeGuess('a')).toBeNull();
    expect(normalizeGuess('two words')).toBeNull();
    expect(normalizeGuess('caf3')).toBeNull();
  });

  it('gives a rank, refuses unknown and repeated words, and wins on the hidden word', () => {
    let round = startRound(data, secret);
    const first = guessWord(round, data, 'Banana');
    expect(first.kind).toBe('ok');
    if (first.kind !== 'ok') {
      throw new Error('not ok');
    }
    round = first.round;
    expect(first.guess.rank).toBe(round.ranking.rankOf[at('banana')]);
    expect(round.guesses).toHaveLength(1);

    expect(guessWord(round, data, 'banana').kind).toBe('duplicate');
    expect(guessWord(round, data, 'zebra')).toEqual({ kind: 'unknown', word: 'zebra' });
    expect(guessWord(round, data, '!!').kind).toBe('invalid');

    const last = guessWord(round, data, 'apple');
    expect(last.kind).toBe('ok');
    if (last.kind !== 'ok') {
      throw new Error('not ok');
    }
    expect(last.round.status).toBe('won');
    expect(guessWord(last.round, data, 'car').kind).toBe('over');
  });

  it('gives hints that come closer and never give the hidden word away', () => {
    let round = startRound(data, secret);
    const ranks: number[] = [];
    for (let hints = 0; hints < 20; hints += 1) {
      const hint = takeHint(round, data);
      if (hint === null) {
        break;
      }
      expect(hint.guess.hint).toBe(true);
      expect(hint.guess.rank).toBeGreaterThanOrEqual(2);
      ranks.push(hint.guess.rank);
      round = hint.round;
    }
    expect(round.status).toBe('playing');
    // Every hint is closer than all the guesses before it, and the hints run out
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(takeHint(round, data)).toBeNull();
    expect(bestRank(round, data.words.length)).toBe(2);
  });

  it('shows the nearest words after giving up', () => {
    const round = giveUp(startRound(data, secret));
    expect(round.status).toBe('gaveUp');
    expect(nearestWords(round, data, 3).map((guess) => guess.rank)).toEqual([1, 2, 3]);
    expect(nearestWords(round, data, 1)[0]?.word).toBe('apple');
    expect(guessWord(round, data, 'car').kind).toBe('over');
    expect(takeHint(round, data)).toBeNull();
  });
});

describe('the radar', () => {
  it('names how close a rank is', () => {
    expect(bucketOf(1).id).toBe('found');
    expect(bucketOf(10).id).toBe('burning');
    expect(bucketOf(11).id).toBe('hot');
    expect(bucketOf(1000).id).toBe('warm');
    expect(bucketOf(5000).id).toBe('cool');
    expect(bucketOf(30000).id).toBe('cold');
  });

  it('puts the hidden word in the middle and the farthest word at the edge', () => {
    expect(radiusOf(1, 30000)).toBe(0);
    expect(radiusOf(30000, 30000)).toBeCloseTo(1, 10);
    expect(radiusOf(100, 30000)).toBeLessThan(radiusOf(1000, 30000));
    expect(closenessOf(1, 30000)).toBe(1);
  });

  it('gives a stable direction to a word, which is different for different words', () => {
    const { order } = rankWords(data, at('apple'));
    const plane = radarPlane(data, order);
    const again = radarPlane(data, order);
    expect([...plane[0]]).toEqual([...again[0]]);
    const angles = ['banana', 'car', 'dog', 'truck'].map((word) =>
      angleOf(data, at('apple'), at(word), plane),
    );
    expect(angles.every(Number.isFinite)).toBe(true);
    expect(new Set(angles.map((angle) => angle.toFixed(3))).size).toBeGreaterThan(1);
    // Words that differ from the hidden word in the same way lie in nearly the same direction
    const car = angleOf(data, at('apple'), at('car'), plane);
    const bus = angleOf(data, at('apple'), at('bus'), plane);
    const dog = angleOf(data, at('apple'), at('dog'), plane);
    const distance = (x: number, y: number): number =>
      Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y)));
    expect(distance(car, bus)).toBeLessThan(distance(car, dog));
  });
});

describe('the map', () => {
  it('flattens words to a square from -1 to 1, and groups similar words', () => {
    const words = ['apple', 'banana', 'pear', 'car', 'truck', 'bus', 'dog', 'cat', 'wolf'];
    const points = flatten(data, words.map(at));
    expect(points).toHaveLength(words.length);
    expect(Math.max(...points.flat().map(Math.abs))).toBeCloseTo(1, 8);
    const gap = (a: number, b: number): number =>
      Math.hypot(
        (points[a]?.[0] ?? 0) - (points[b]?.[0] ?? 0),
        (points[a]?.[1] ?? 0) - (points[b]?.[1] ?? 0),
      );
    expect(gap(0, 1)).toBeLessThan(gap(0, 3));
    expect(gap(3, 4)).toBeLessThan(gap(3, 6));
  });

  it('makes the same map every time, and copes with one or no point', () => {
    const words = ['apple', 'car', 'dog'].map(at);
    expect(flatten(data, words)).toEqual(flatten(data, words));
    expect(flatten(data, [])).toEqual([]);
    expect(flatten(data, [at('apple')])).toEqual([[0, 0]]);
  });
});

describe('the address of a round', () => {
  it('reads a seed, and writes the link of a round', () => {
    expect(parseSeed('?seed=42', () => 1)).toBe(42);
    expect(parseSeed('', () => 1)).toBe(1);
    expect(parseSeed('?seed=hello', () => 1)).toBe(parseSeed('?seed=hello', () => 2));
    expect(buildRoundUrl('https://x.test/games/word-radar/', 99)).toBe(
      'https://x.test/games/word-radar/?seed=99',
    );
  });
});
