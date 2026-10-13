import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { DIMENSIONS, makeWordData, parseWordList } from '../logic/data';
import { nearestWords, startRound, takeHint } from '../logic/round';
import { similarityTo } from '../logic/similarity';

const here = (name: string): string =>
  new URL(name, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const vocabularyText = readFileSync(here('./vocabulary.txt'), 'utf8');
const secretsText = readFileSync(here('./secrets.txt'), 'utf8');
const bytes = readFileSync(here('./vectors.bin'));
const blockedText = readFileSync(
  here('../../../../scripts/word-radar/blocked-secrets.txt'),
  'utf8',
);

const words = parseWordList(vocabularyText);
const secrets = parseWordList(secretsText);
const data = makeWordData(
  vocabularyText,
  new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  secretsText,
);
const at = (word: string): number => {
  const index = data.indexOf.get(word);
  if (index === undefined) {
    throw new Error(`${word} is not in the list`);
  }
  return index;
};

describe('the word list of Word Radar', () => {
  it('has 30,000 different words, all lower case letters, commonest first', () => {
    expect(words).toHaveLength(30_000);
    expect(new Set(words).size).toBe(words.length);
    for (const word of words) {
      expect(word, word).toMatch(/^[a-z]{2,15}$/);
    }
    // The most common words come first
    expect(words.indexOf('time')).toBeLessThan(words.indexOf('tractor'));
    expect(words.indexOf('water')).toBeLessThan(words.indexOf('volcano'));
  });

  it('has no little words that carry no meaning', () => {
    for (const word of ['the', 'and', 'of', 'to', 'is', 'was', 'for', 'with', 'this', 'that']) {
      expect(words, word).not.toContain(word);
    }
  });

  it('has one row of 64 whole numbers for every word, and nothing else', () => {
    expect(bytes.length).toBe(words.length * DIMENSIONS);
    const used = new Set(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    expect(used.size).toBeGreaterThan(150);
  });
});

describe('the words that can be hidden', () => {
  const blocked = new Set(
    blockedText
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .flatMap((line) => line.split(/\s+/))
      .filter(Boolean),
  );

  it('are enough, all different, all in the word list and everyday words', () => {
    expect(secrets.length).toBeGreaterThanOrEqual(1200);
    expect(secrets.length).toBeLessThanOrEqual(3000);
    expect(new Set(secrets).size).toBe(secrets.length);
    for (const word of secrets) {
      expect(data.indexOf.has(word), word).toBe(true);
      expect(word.length, word).toBeGreaterThanOrEqual(3);
      expect(word.length, word).toBeLessThanOrEqual(10);
    }
    for (const word of ['dog', 'apple', 'ocean', 'guitar', 'volcano']) {
      expect(secrets, word).toContain(word);
    }
  });

  it('never include a blocked word', () => {
    expect(blocked.size).toBeGreaterThan(100);
    expect(secrets.filter((word) => blocked.has(word))).toEqual([]);
  });
});

describe('the meaning in the numbers', () => {
  const similarity = (a: string, b: string): number => similarityTo(data, at(a))[at(b)] ?? 0;

  it('puts words that go together closer than words that do not', () => {
    const cases: [string, string, string][] = [
      ['king', 'queen', 'banana'],
      ['dog', 'cat', 'car'],
      ['car', 'truck', 'apple'],
      ['ocean', 'sea', 'shoe'],
      ['doctor', 'hospital', 'mountain'],
      ['guitar', 'piano', 'bridge'],
      ['winter', 'snow', 'engine'],
    ];
    for (const [word, near, far] of cases) {
      expect(similarity(word, near), `${word} ${near} ${far}`).toBeGreaterThan(
        similarity(word, far),
      );
    }
  });

  it('finds the neighbors that a person would expect', () => {
    const round = startRound(data, at('volcano'));
    const nearest = nearestWords(round, data, 15).map((guess) => guess.word);
    expect(nearest[0]).toBe('volcano');
    expect(nearest).toContain('eruption');
    expect(nearest).toContain('lava');
    const pizza = nearestWords(startRound(data, at('pizza')), data, 25).map((guess) => guess.word);
    expect(pizza).toContain('pasta');
    expect(pizza).toContain('sandwich');
  });

  it('puts the vectors in one unit of length', () => {
    for (const word of [0, 1000, 29_999]) {
      let sum = 0;
      for (let index = 0; index < DIMENSIONS; index += 1) {
        sum += (data.vectors[word * DIMENSIONS + index] ?? 0) ** 2;
      }
      expect(sum).toBeCloseTo(1, 4);
    }
  });
});

describe('the hints', () => {
  it('come closer in small steps, from about rank 2,000 down to 2', () => {
    let round = startRound(data, at('volcano'));
    const ranks: number[] = [];
    for (let count = 0; count < 40; count += 1) {
      const hint = takeHint(round, data);
      if (hint === null) {
        break;
      }
      ranks.push(hint.guess.rank);
      round = hint.round;
    }
    expect(ranks.slice(0, 5)).toEqual([2000, 1000, 500, 250, 125]);
    expect(ranks.at(-1)).toBe(2);
    // No step is more than a halving
    for (const [index, rank] of ranks.entries()) {
      const before = ranks[index - 1];
      if (before !== undefined) {
        expect(rank, `after ${String(before)}`).toBeGreaterThanOrEqual(Math.floor(before / 2));
        expect(rank).toBeLessThan(before);
      }
    }
  });
});
