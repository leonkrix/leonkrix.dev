import { z } from 'astro/zod';

export const experienceTypes = ['education', 'work'] as const;
export type ExperienceType = (typeof experienceTypes)[number];

/** Section headings and icons per type, in display order. */
export const experienceGroups: readonly { type: ExperienceType; title: string; icon: string }[] = [
  { type: 'education', title: 'Education', icon: 'lucide:graduation-cap' },
  { type: 'work', title: 'Work', icon: 'lucide:briefcase' },
];

/** A month as "YYYY-MM", e.g. "2024-04". */
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'expected YYYY-MM');

export const experienceSchema = z
  .object({
    type: z.enum(experienceTypes),
    /** Degree or role, e.g. "M.Sc. Information Systems" */
    title: z.string().min(1),
    /** Short label for the timeline strip, e.g. "M.Sc." (the title is used when missing) */
    short: z.string().min(1).max(30).optional(),
    organization: z.string().min(1),
    /** Optional sub-unit, e.g. a chair or department */
    unit: z.string().min(1).optional(),
    start: month,
    /** Leave out for a current position */
    end: month.optional(),
    highlights: z.array(z.string().min(1)).min(1).max(4),
    /** Optional relevant courses, shown as a compact list */
    coursework: z.array(z.string().min(1)).max(10).optional(),
    /** Optional id of a project (file name in src/content/projects) this entry relates to */
    relatedProject: z.string().min(1).optional(),
  })
  .refine((entry) => entry.end === undefined || entry.end >= entry.start, {
    message: 'end must not be before start',
    path: ['end'],
  });

export type ExperienceEntry = z.infer<typeof experienceSchema>;

type Dated = Pick<ExperienceEntry, 'start' | 'end'>;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "2024-04" becomes "Apr 2024" */
export function formatMonth(value: string): string {
  const [year, monthNumber] = value.split('-');
  const name = MONTH_NAMES[Number(monthNumber) - 1];
  if (year === undefined || name === undefined) {
    throw new Error(`Invalid month "${value}", expected YYYY-MM.`);
  }
  return `${name} ${year}`;
}

/** "Apr 2024 – Sep 2026", or "Apr 2024 – Present" when there is no end */
export function formatRange({ start, end }: Dated): string {
  return `${formatMonth(start)} – ${end === undefined ? 'Present' : formatMonth(end)}`;
}

/** Newest first. A position without an end counts as current and comes first. */
export function sortExperience<T extends Dated>(entries: readonly T[]): T[] {
  const key = (entry: Dated): string => entry.end ?? '9999-12';
  return [...entries].sort(
    (a, b) => key(b).localeCompare(key(a)) || b.start.localeCompare(a.start),
  );
}
