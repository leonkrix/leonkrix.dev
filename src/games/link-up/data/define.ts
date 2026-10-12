/** One term as written in the data files: how it is shown on a tile, and what it means. */
export type RawTerm = readonly [name: string, definition: string];

/** One category as written in the data files. */
export interface RawCategory {
  /** Lowercase words joined by hyphens, unique */
  id: string;
  /** The title of the group once it is found */
  name: string;
  /** One sentence in our own words (at most 100 characters) about what the group has in common */
  description: string;
  terms: readonly RawTerm[];
}

export interface Term {
  /** As shown on the tile; no two terms of the whole pool have the same name */
  name: string;
  /** One sentence in our own words, at most 100 characters, without the name itself */
  definition: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  terms: readonly Term[];
}

/** Turns the compact entries of a data file into categories. */
export function defineCategories(raw: readonly RawCategory[]): Category[] {
  return raw.map(({ id, name, description, terms }) => ({
    id,
    name,
    description,
    terms: terms.map(([termName, definition]) => ({ name: termName, definition })),
  }));
}
