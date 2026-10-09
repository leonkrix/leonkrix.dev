import { type Random } from '../../shared/random';
import { type TechCategory, type TechTerm } from '../../shared/tech-term';

/** The word lengths the game offers. */
export const LENGTHS = [3, 4, 5] as const;

export type WordLength = (typeof LENGTHS)[number];

/** A category is offered for a length only when it has at least this many terms. */
export const MIN_TERMS_PER_CATEGORY = 5;

export type CategoryChoice = TechCategory | 'all';

export function isWordLength(value: number): value is WordLength {
  return (LENGTHS as readonly number[]).includes(value);
}

/** How many terms each category has in this list. Categories without terms have no entry. */
export function categoryCounts(terms: readonly TechTerm[]): Map<TechCategory, number> {
  const counts = new Map<TechCategory, number>();
  for (const { category } of terms) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

/** The terms a round can pick its answer from. */
export function answerPool(terms: readonly TechTerm[], category: CategoryChoice): TechTerm[] {
  return category === 'all' ? [...terms] : terms.filter((term) => term.category === category);
}

/**
 * Picks the hidden term. A category that has too few terms for this list falls back to all
 * terms, so a round can always start.
 */
export function selectTerm(
  terms: readonly TechTerm[],
  category: CategoryChoice,
  random: Random,
): TechTerm {
  const pool = answerPool(terms, category);
  return random.pick(pool.length >= MIN_TERMS_PER_CATEGORY ? pool : terms);
}
