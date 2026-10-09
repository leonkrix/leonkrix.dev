/**
 * The vocabulary shared by the word games (Tech Words now, Link Up later): one term with a
 * category and a short definition in our own words. The lists themselves live with the games.
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
