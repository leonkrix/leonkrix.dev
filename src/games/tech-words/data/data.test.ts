import { describe, expect, it } from 'vitest';

import { techCategories, type TechTerm } from '../../shared/tech-term';
import { evaluateGuess } from '../logic/evaluate';
import { LENGTHS, MIN_TERMS_PER_CATEGORY, type WordLength } from '../logic/select';
import { PREVIEW_ANSWER, PREVIEW_GUESS } from '../preview-words';
import { loadTerms } from './index';
import { terms3 } from './terms-3';
import { terms4 } from './terms-4';
import { terms5 } from './terms-5';

/** The lists grow over time; these are the sizes they must never fall below. */
const MINIMUM: Record<WordLength, number> = { 3: 150, 4: 500, 5: 780 };

const lists: Record<WordLength, readonly TechTerm[]> = { 3: terms3, 4: terms4, 5: terms5 };

/** Words we never want in the game, whatever they mean in tech. */
const BLOCKED = new Set([
  'ass',
  'sex',
  'fuck',
  'shit',
  'cunt',
  'dick',
  'porn',
  'rape',
  'nazi',
  'whore',
  'bitch',
  'slut',
  'nigga',
  'fag',
  'kike',
  'spic',
  'tits',
]);

/** What is wrong with a definition, as a list of short descriptions (empty when it is fine). */
function definitionProblems(term: string, definition: string): string[] {
  const found: string[] = [];
  if (definition !== definition.trim()) {
    found.push('has spaces around it');
  }
  if (definition.length <= 10) {
    found.push('is too short');
  }
  if (definition.length > 100) {
    found.push(`is ${String(definition.length)} characters long`);
  }
  if (!/^[A-Z]/.test(definition)) {
    found.push('does not start with a capital letter');
  }
  if (!definition.endsWith('.')) {
    found.push('does not end with a period');
  }
  if (/ {2}|\n|\t/.test(definition)) {
    found.push('has double spaces or line breaks');
  }
  if (new RegExp(`\\b${term}\\b`, 'i').test(definition)) {
    found.push('gives the term away');
  }
  return found.map((problem) => `${term}: definition ${problem}`);
}

describe.each(LENGTHS)('terms with %i letters', (length) => {
  const terms = lists[length];

  it(`has at least ${String(MINIMUM[length])} terms`, () => {
    expect(terms.length).toBeGreaterThanOrEqual(MINIMUM[length]);
  });

  it('has only lowercase letters a to z, and exactly the right length', () => {
    const wrong = terms
      .filter(({ term }) => !/^[a-z]+$/.test(term) || term.length !== length)
      .map(({ term }) => term);
    expect(wrong).toEqual([]);
  });

  it('has no term twice', () => {
    const seen = new Set<string>();
    const repeated = terms.filter(({ term }) => seen.size === seen.add(term).size);
    expect(repeated.map(({ term }) => term)).toEqual([]);
  });

  it('uses only known categories', () => {
    const unknown = terms.filter(({ category }) => !techCategories.includes(category));
    expect(unknown.map(({ term }) => term)).toEqual([]);
  });

  it('has enough terms in every category for the category filter', () => {
    for (const category of techCategories) {
      const count = terms.filter((term) => term.category === category).length;
      expect(count, `${category} with ${String(length)} letters`).toBeGreaterThanOrEqual(
        MIN_TERMS_PER_CATEGORY,
      );
    }
  });

  it('has a clean definition for every term: at most 100 characters, our own words, no giveaway', () => {
    const problems = terms.flatMap(({ term, definition }) => definitionProblems(term, definition));
    expect(problems).toEqual([]);
  });

  it('is sorted by category, in the order of the category list, and then alphabetically', () => {
    const outOfOrder = terms.filter((current, index) => {
      const previous = terms[index - 1];
      if (previous === undefined) {
        return false;
      }
      const byCategory =
        techCategories.indexOf(previous.category) - techCategories.indexOf(current.category);
      return byCategory > 0 || (byCategory === 0 && previous.term > current.term);
    });
    expect(outOfOrder.map(({ term }) => term)).toEqual([]);
  });

  it('has no definition twice', () => {
    const seen = new Set<string>();
    const repeated = terms.filter(({ definition }) => seen.size === seen.add(definition).size);
    expect(repeated.map(({ term }) => term)).toEqual([]);
  });

  it('contains no blocked word', () => {
    expect(terms.filter(({ term }) => BLOCKED.has(term)).map(({ term }) => term)).toEqual([]);
  });
});

describe('across all lengths', () => {
  it('has no term in two lists', () => {
    const all = [...terms3, ...terms4, ...terms5].map(({ term }) => term);
    expect(new Set(all).size).toBe(all.length);
  });

  it('loads every list through loadTerms', async () => {
    for (const length of LENGTHS) {
      expect(await loadTerms(length), String(length)).toBe(lists[length]);
    }
  });
});

describe('the example in the tile of the game', () => {
  it('uses two terms of the five-letter list, and a guess that is not the answer', () => {
    const known = new Set(terms5.map(({ term }) => term));
    expect(known.has(PREVIEW_GUESS)).toBe(true);
    expect(known.has(PREVIEW_ANSWER)).toBe(true);
    expect(PREVIEW_GUESS).not.toBe(PREVIEW_ANSWER);
  });

  it('shows all three results, so the example explains the colors', () => {
    const states = new Set(evaluateGuess(PREVIEW_GUESS, PREVIEW_ANSWER));
    expect([...states].sort()).toEqual(['absent', 'correct', 'present']);
  });
});

describe('definitionProblems', () => {
  it('finds every kind of problem', () => {
    expect(definitionProblems('cat', 'A cat.')).toEqual([
      'cat: definition is too short',
      'cat: definition gives the term away',
    ]);
    expect(definitionProblems('cat', 'a small furry animal')).toEqual([
      'cat: definition does not start with a capital letter',
      'cat: definition does not end with a period',
    ]);
    expect(definitionProblems('cat', `A ${'very '.repeat(30)}small animal.`)[0]).toMatch(
      /is \d+ characters long/,
    );
  });

  it('accepts a good definition', () => {
    expect(definitionProblems('cat', 'A small furry animal that purrs.')).toEqual([]);
  });
});
