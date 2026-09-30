import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

import { experienceSchema } from './lib/experience';
import { projectSchema } from './lib/projects';

const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema: projectSchema,
});

const experience = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/experience' }),
  schema: experienceSchema,
});

export const collections = { projects, experience };
