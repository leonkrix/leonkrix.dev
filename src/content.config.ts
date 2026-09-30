import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

import { projectSchema } from './lib/projects';

const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema: projectSchema,
});

export const collections = { projects };
