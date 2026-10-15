import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { gamePaths } from '../../src/games/registry';
import { notePath, notesPath } from '../../src/lib/notes';

/** The notes ("Behind the scenes"): the overview and one page per file in src/content/notes */
function notePaths(): readonly string[] {
  const folder = join(import.meta.dirname, '..', '..', 'src', 'content', 'notes');
  const slugs = readdirSync(folder)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => name.replace(/\.mdx$/, ''));
  return slugs.length === 0 ? [] : [notesPath, ...slugs.map(notePath)];
}

/**
 * Pages that exist on the site. The Playground pages are included as soon as a game is live and
 * the notes as soon as there is one, so every test that loops over the pages covers them. A test in
 * `tests/build-output` compares this list with the pages of the build, so a new page cannot be
 * forgotten.
 */
export const pages: readonly string[] = [
  '/',
  '/legal-notice/',
  '/privacy-policy/',
  '/uses/',
  ...gamePaths(),
  ...notePaths(),
];

/** An address that does not exist, which shows the 404 page */
export const notFoundPath = '/this-page-does-not-exist';
