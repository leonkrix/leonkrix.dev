import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

import { experienceSchema } from './lib/experience';
import { noteSchema } from './lib/notes';
import { projectSchema } from './lib/projects';

const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema: projectSchema,
});

const experience = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/experience' }),
  schema: experienceSchema,
});

const notes = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/notes' }),
  schema: noteSchema,
});

export const collections = { projects, experience, notes };
