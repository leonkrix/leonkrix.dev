import { z } from 'astro/zod';

/** Address of the overview of the notes ("Behind the scenes"). */
export const notesPath = '/notes/';

/** The groups of the overview, in the order they are shown */
export const noteGroups = [
  { id: 'site', title: 'The site' },
  { id: 'games', title: 'The games' },
] as const;

export type NoteGroup = (typeof noteGroups)[number]['id'];

export function notePath(slug: string): string {
  return `${notesPath}${slug}/`;
}

/**
 * A note is one page that explains how something on this site is made (a game, or the site
 * itself): an MDX file in `src/content/notes/`, the file name is the address.
 */
export const noteSchema = z.object({
  title: z.string().min(1),
  /** One or two sentences: the line on the overview and the description of the page */
  summary: z.string().min(40).max(240),
  /** The small label above the title, for example "Logic · Root Cause" */
  tag: z.string().min(1),
  /** The game this note is about (its slug in `src/games/registry.ts`): the game links here */
  game: z
    .string()
    .regex(/^[a-z]+(-[a-z]+)*$/)
    .optional(),
  /** Folder of the code in the repository, shown as a link to GitHub */
  code: z
    .string()
    .regex(/^[\w./-]+$/)
    .refine((path) => !path.split('/').includes('..'), 'no parent folders')
    .optional(),
  /** The part of the overview the note is shown in */
  group: z.enum(['site', 'games']),
  /** Position within its group (lowest first), unique in the group */
  order: z.number().int(),
  /** The day of the last change of the text, as YYYY-MM-DD */
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type Note = z.infer<typeof noteSchema>;

/** Notes in the order of the overview: by group, then by position in the group. */
export function sortNotes<T extends { data: Pick<Note, 'group' | 'order'> }>(
  notes: readonly T[],
): T[] {
  const rank = (group: NoteGroup): number => noteGroups.findIndex((one) => one.id === group);
  return [...notes].sort(
    (a, b) => rank(a.data.group) - rank(b.data.group) || a.data.order - b.data.order,
  );
}

/** About 200 words a minute, at least one minute. */
export function readingMinutes(text: string): number {
  const words = text.split(/\s+/u).filter((word) => word.length > 0).length;
  return Math.max(1, Math.round(words / 200));
}

/** "2026-10-14" as "14 October 2026" (written out, so that every reader understands it) */
export function formatUpdated(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${String(date)} ${names[(month ?? 1) - 1] ?? ''} ${String(year)}`;
}
