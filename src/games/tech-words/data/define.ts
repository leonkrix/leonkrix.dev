import { type TechCategory, type TechTerm } from '../../shared/tech-term';

/** One entry as written in the data files: the term, its category and a short definition. */
export type RawTerm = readonly [term: string, category: TechCategory, definition: string];

/** Turns the compact entries of a data file into terms. */
export function defineTerms(raw: readonly RawTerm[]): TechTerm[] {
  return raw.map(([term, category, definition]) => ({ term, category, definition }));
}
