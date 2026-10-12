import { aiCategories } from './categories-ai';
import { cloudCategories } from './categories-cloud';
import { csCategories } from './categories-cs';
import { dataCategories } from './categories-data';
import { hardwareCategories } from './categories-hardware';
import { languageCategories } from './categories-languages';
import { machineLearningCategories } from './categories-ml';
import { networkCategories } from './categories-network';
import { securityCategories } from './categories-security';
import { softwareCategories } from './categories-software';
import { systemCategories } from './categories-system';
import { theoryCategories } from './categories-theory';
import { toolCategories } from './categories-tools';
import { webCategories } from './categories-web';
import { type Category } from './define';
import { type ShardId } from './shards';

export { conflicts } from './conflicts';
export type { Category, Term } from './define';

/**
 * All categories, file by file. This module pulls in every file, so the game does not use it (it
 * fetches the files it needs through `shards.ts` and `catalog.ts`); tests and tools do. The keys
 * and their order are the same as in `shardLoaders`, and the order of the catalog follows it.
 */
export const shardCategories: Record<ShardId, readonly Category[]> = {
  cs: csCategories,
  theory: theoryCategories,
  languages: languageCategories,
  software: softwareCategories,
  web: webCategories,
  data: dataCategories,
  cloud: cloudCategories,
  network: networkCategories,
  security: securityCategories,
  system: systemCategories,
  hardware: hardwareCategories,
  tools: toolCategories,
  ml: machineLearningCategories,
  ai: aiCategories,
};

/** Every category of the game, grouped by topic in the files. */
export const categories: readonly Category[] = Object.values(shardCategories).flat();
