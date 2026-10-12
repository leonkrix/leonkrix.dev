/**
 * The vocabulary of the word games (so far only Tech Words uses it): one term with a category
 * and a short definition in our own words. Link Up has its own, finer data.
 */

export const techCategories = [
  'languages',
  'web',
  'data',
  'networking',
  'hardware',
  'os',
  'security',
  'devops',
  'ml',
  'cs',
] as const;

export type TechCategory = (typeof techCategories)[number];

export const techCategoryLabels: Record<TechCategory, string> = {
  languages: 'Languages',
  web: 'Web',
  data: 'Data',
  networking: 'Networking',
  hardware: 'Hardware',
  os: 'Operating systems',
  security: 'Security',
  devops: 'DevOps',
  ml: 'Machine learning',
  cs: 'Computer science',
};

export interface TechTerm {
  /** Lowercase letters a to z only */
  term: string;
  category: TechCategory;
  /** One sentence in our own words, at most 100 characters */
  definition: string;
}
