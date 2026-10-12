import { type Category } from './define';

/**
 * The categories are split into files by topic, and a file is only fetched when a puzzle needs one
 * of its categories (a puzzle uses four categories, so usually three or four of the fourteen
 * files). This module is small and is part of the first script of the game; the files are not.
 * `index.ts` lists the same keys in the same order (a data test checks that).
 */
export const shardLoaders = {
  cs: async (): Promise<readonly Category[]> => (await import('./categories-cs')).csCategories,
  theory: async (): Promise<readonly Category[]> =>
    (await import('./categories-theory')).theoryCategories,
  languages: async (): Promise<readonly Category[]> =>
    (await import('./categories-languages')).languageCategories,
  software: async (): Promise<readonly Category[]> =>
    (await import('./categories-software')).softwareCategories,
  web: async (): Promise<readonly Category[]> => (await import('./categories-web')).webCategories,
  data: async (): Promise<readonly Category[]> =>
    (await import('./categories-data')).dataCategories,
  cloud: async (): Promise<readonly Category[]> =>
    (await import('./categories-cloud')).cloudCategories,
  network: async (): Promise<readonly Category[]> =>
    (await import('./categories-network')).networkCategories,
  security: async (): Promise<readonly Category[]> =>
    (await import('./categories-security')).securityCategories,
  system: async (): Promise<readonly Category[]> =>
    (await import('./categories-system')).systemCategories,
  hardware: async (): Promise<readonly Category[]> =>
    (await import('./categories-hardware')).hardwareCategories,
  tools: async (): Promise<readonly Category[]> =>
    (await import('./categories-tools')).toolCategories,
  ml: async (): Promise<readonly Category[]> =>
    (await import('./categories-ml')).machineLearningCategories,
  ai: async (): Promise<readonly Category[]> => (await import('./categories-ai')).aiCategories,
} as const;

export type ShardId = keyof typeof shardLoaders;
