import { z } from 'astro/zod';

import { technologies, type TechnologyId } from './technologies';

const technologyIds = Object.keys(technologies) as [TechnologyId, ...TechnologyId[]];

export const projectKinds = ['project', 'bachelor-thesis', 'master-thesis'] as const;
export type ProjectKind = (typeof projectKinds)[number];

export const kindLabels: Record<ProjectKind, string> = {
  project: 'Project',
  'bachelor-thesis': "Bachelor's thesis",
  'master-thesis': "Master's thesis",
};

const year = z.number().int().min(2000).max(2100);

/**
 * Where the source code can be found:
 * - public: a GitHub repository (the link is shown)
 * - planned: will be published later (shown as "Code coming soon")
 * - none: not available (shown as "Private project"), never carries a link
 */
const code = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('public'),
    url: z.url().refine((url) => url.startsWith('https://github.com/'), {
      message: 'must be a https://github.com/ URL',
    }),
  }),
  z.object({ status: z.literal('planned') }),
  z.object({ status: z.literal('none') }),
]);

export const projectSchema = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    kind: z.enum(projectKinds),
    /** Optional institution, shown next to the kind, e.g. "TUM" for a thesis */
    institution: z.string().min(1).optional(),
    /** Optional grade, shown as a small badge, e.g. "1.0" (best possible in the German system) */
    grade: z.string().min(1).optional(),
    start: year,
    end: year.optional(),
    highlights: z.array(z.string().min(1)).min(1).max(5),
    /** Optional key figures shown as a strip, e.g. { value: "−47%", label: "mean delay" } */
    stats: z
      .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
      .min(1)
      .max(4)
      .optional(),
    technologies: z.array(z.enum(technologyIds)).min(1),
    code,
    /** Short extra remark shown next to the code status, e.g. "No longer available." */
    note: z.string().min(1).optional(),
  })
  .refine((project) => project.end === undefined || project.end >= project.start, {
    message: 'end must not be before start',
    path: ['end'],
  });

export type Project = z.infer<typeof projectSchema>;

type Dated = Pick<Project, 'start' | 'end'>;

/** "2019" or "2023 – 2024" */
export function formatPeriod({ start, end }: Dated): string {
  return end === undefined || end === start ? String(start) : `${String(start)} – ${String(end)}`;
}

/** Newest first: by end year, then by start year, then by title. */
export function sortProjects<T extends Dated & { title: string }>(projects: readonly T[]): T[] {
  return [...projects].sort(
    (a, b) =>
      (b.end ?? b.start) - (a.end ?? a.start) ||
      b.start - a.start ||
      a.title.localeCompare(b.title),
  );
}
