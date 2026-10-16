import { describe, expect, it } from 'vitest';

import { parseShard, takeShard } from './shard.mjs';

const pages = Array.from({ length: 16 }, (_, index) => `/page-${String(index)}/`);

describe('parseShard', () => {
  it('reads the second of three', () => {
    expect(parseShard('2/3')).toEqual({ index: 2, count: 3 });
    expect(parseShard('1/1')).toEqual({ index: 1, count: 1 });
  });

  it('refuses everything that is not a shard, so a typo never runs fewer pages', () => {
    for (const spec of ['', '3', '0/3', '4/3', '1/0', 'a/b', '1/3/5', undefined]) {
      expect(() => parseShard(spec), String(spec)).toThrow('Invalid --shard');
    }
  });
});

describe('takeShard', () => {
  it('gives every page to exactly one shard, for any number of shards', () => {
    for (let count = 1; count <= 6; count += 1) {
      const parts = Array.from({ length: count }, (_, index) =>
        takeShard(pages, `${String(index + 1)}/${String(count)}`),
      );
      expect(parts.flat().sort(), `${String(count)} shards`).toEqual([...pages].sort());
      expect(new Set(parts.flat()).size).toBe(pages.length);
    }
  });

  it('keeps the order, and shares the work evenly (the sizes differ by one at most)', () => {
    const parts = [1, 2, 3].map((index) => takeShard(pages, `${String(index)}/3`));
    for (const part of parts) {
      expect([...part].sort((a, b) => pages.indexOf(a) - pages.indexOf(b))).toEqual(part);
    }
    const sizes = parts.map((part) => part.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('gives everything to the only shard', () => {
    expect(takeShard(pages, '1/1')).toEqual(pages);
  });
});
