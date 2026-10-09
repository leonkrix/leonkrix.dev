import { describe, expect, it } from 'vitest';

import { createRandom, freshSeed, hashSeed } from './random';

describe('createRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const first = createRandom(42);
    const second = createRandom(42);
    expect(Array.from({ length: 20 }, () => first.next())).toEqual(
      Array.from({ length: 20 }, () => second.next()),
    );
  });

  it('gives different sequences for different seeds', () => {
    expect(createRandom(1).next()).not.toBe(createRandom(2).next());
  });

  it('accepts text seeds and treats them like their hash', () => {
    expect(createRandom('root-cause').next()).toBe(createRandom(hashSeed('root-cause')).next());
  });

  it('keeps next() within 0 (included) and 1 (excluded)', () => {
    const random = createRandom(7);
    for (let index = 0; index < 10_000; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('keeps int() within its limit and reaches every value', () => {
    const random = createRandom(3);
    const seen = new Set<number>();
    for (let index = 0; index < 2_000; index += 1) {
      const value = random.int(6);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('rejects limits that are not whole numbers of at least 1', () => {
    const random = createRandom(1);
    for (const limit of [0, -3, 1.5, Number.NaN]) {
      expect(() => random.int(limit), String(limit)).toThrow(RangeError);
    }
  });

  it('picks only elements of the list and rejects an empty list', () => {
    const random = createRandom(9);
    const items = ['a', 'b', 'c'] as const;
    for (let index = 0; index < 100; index += 1) {
      expect(items).toContain(random.pick(items));
    }
    expect(() => random.pick([])).toThrow(RangeError);
  });

  it('shuffles into a permutation without changing the original', () => {
    const random = createRandom(11);
    const items = Array.from({ length: 30 }, (_, index) => index);
    const shuffled = random.shuffle(items);
    expect(shuffled).not.toEqual(items);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(items[0]).toBe(0);
  });

  it('shuffles reproducibly', () => {
    const items = ['x', 'y', 'z', 'u', 'v'];
    expect(createRandom('s').shuffle(items)).toEqual(createRandom('s').shuffle(items));
  });
});

describe('hashSeed and freshSeed', () => {
  it('hashes text to a stable 32 bit number', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('gives a 32 bit whole number', () => {
    const seed = freshSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});
