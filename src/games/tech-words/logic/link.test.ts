import { describe, expect, it } from 'vitest';

import { createRandom, hashSeed } from '../../shared/random';
import { techCategories, type TechTerm } from '../../shared/tech-term';
import { buildPuzzleUrl, parsePuzzleParams, parseSeed, type PuzzleSetup } from './link';
import { LENGTHS, selectTerm } from './select';

const fresh = (): number => 4242;

describe('parseSeed', () => {
  it('takes digits as the seed itself', () => {
    expect(parseSeed('0')).toBe(0);
    expect(parseSeed('123456')).toBe(123456);
    expect(parseSeed('4294967295')).toBe(4294967295);
  });

  it('turns any other text into a seed', () => {
    expect(parseSeed('demo')).toBe(hashSeed('demo'));
    expect(parseSeed('12a')).toBe(hashSeed('12a'));
    expect(parseSeed('-5')).toBe(hashSeed('-5'));
    // Too long for a seed, so it counts as text
    expect(parseSeed('12345678901')).toBe(hashSeed('12345678901'));
  });
});

describe('parsePuzzleParams', () => {
  it('uses the defaults and a fresh seed when nothing is given', () => {
    expect(parsePuzzleParams('', fresh)).toEqual({ length: 5, category: 'all', seed: 4242 });
  });

  it('reads length, category and seed', () => {
    expect(parsePuzzleParams('?length=4&category=security&seed=77', fresh)).toEqual({
      length: 4,
      category: 'security',
      seed: 77,
    });
  });

  it('replaces what is not valid', () => {
    expect(parsePuzzleParams('?length=9&category=cooking&seed=', fresh)).toEqual({
      length: 5,
      category: 'all',
      seed: 4242,
    });
    expect(parsePuzzleParams('?length=abc', fresh).length).toBe(5);
  });

  it('does not ask for a fresh seed when the address has one', () => {
    let asked = 0;
    parsePuzzleParams('?seed=5', () => {
      asked += 1;
      return 1;
    });
    expect(asked).toBe(0);
  });
});

describe('buildPuzzleUrl', () => {
  const page = 'https://leonkrix.dev/games/tech-words/';

  it('writes the setup as a readable query', () => {
    expect(buildPuzzleUrl(page, { length: 4, category: 'all', seed: 99 })).toBe(
      `${page}?length=4&seed=99`,
    );
    expect(buildPuzzleUrl(page, { length: 3, category: 'ml', seed: 5 })).toBe(
      `${page}?length=3&category=ml&seed=5`,
    );
  });

  it('gives back the same setup when it is read again, for every length and category', () => {
    const random = createRandom('round-trip');
    for (const length of LENGTHS) {
      for (const category of ['all', ...techCategories] as const) {
        const setup: PuzzleSetup = { length, category, seed: random.int(2 ** 32) };
        const url = new URL(buildPuzzleUrl(page, setup));
        expect(parsePuzzleParams(url.search, fresh)).toEqual(setup);
      }
    }
  });

  it('opens the same term: the link of a result leads to the puzzle that was played', () => {
    const terms: TechTerm[] = Array.from({ length: 40 }, (_, index) => ({
      term: `a${String(index).padStart(2, '0')}`,
      category: 'cs',
      definition: 'x',
    }));
    const setup: PuzzleSetup = { length: 3, category: 'all', seed: 3141592653 };
    const played = selectTerm(terms, setup.category, createRandom(setup.seed));
    const opened = parsePuzzleParams(new URL(buildPuzzleUrl(page, setup)).search, fresh);
    expect(selectTerm(terms, opened.category, createRandom(opened.seed))).toEqual(played);
  });
});
