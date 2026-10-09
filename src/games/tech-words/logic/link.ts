import { hashSeed } from '../../shared/random';
import { techCategories } from '../../shared/tech-term';
import { type CategoryChoice, isWordLength, type WordLength } from './select';

/** Everything that decides which term a round hides. The same setup always gives the same term. */
export interface PuzzleSetup {
  length: WordLength;
  category: CategoryChoice;
  seed: number;
}

/**
 * A seed written in the address. Digits are the seed itself, which is what the links of copied
 * results contain; any other text is turned into a seed, so a readable word works as well.
 */
export function parseSeed(text: string): number {
  return /^\d{1,10}$/.test(text) ? Number(text) >>> 0 : hashSeed(text);
}

/**
 * Reads the setup of a round from the query part of the address (?length=4&category=security
 * &seed=123). Whatever is missing or not valid is replaced: five letters, all categories and a
 * fresh seed.
 */
export function parsePuzzleParams(search: string, freshSeed: () => number): PuzzleSetup {
  const params = new URLSearchParams(search);
  const length = Number(params.get('length'));
  const seed = params.get('seed');
  return {
    length: isWordLength(length) ? length : 5,
    category: techCategories.find((category) => category === params.get('category')) ?? 'all',
    seed: seed === null || seed === '' ? freshSeed() : parseSeed(seed),
  };
}

/** The address that opens the very same puzzle: the link in the text of a copied result. */
export function buildPuzzleUrl(pageUrl: string, setup: PuzzleSetup): string {
  const params = new URLSearchParams({ length: String(setup.length) });
  if (setup.category !== 'all') {
    params.set('category', setup.category);
  }
  params.set('seed', String(setup.seed >>> 0));
  return `${pageUrl}?${params.toString()}`;
}
