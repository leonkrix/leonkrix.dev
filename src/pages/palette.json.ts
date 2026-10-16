import { execFileSync } from 'node:child_process';

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { games, liveGames } from '@/games/registry';
import { getNavLinks } from '@/lib/navigation';
import { notePath, sortNotes } from '@/lib/notes';
import { buildPaletteData, parseCommits } from '@/lib/palette-data';
import { formatPeriod, sortProjects } from '@/lib/projects';
import { now, siteConfig, socialLinks } from '@/lib/site';
import { usesSummary } from '@/lib/uses';

/** The latest commits for `git log` in the terminal; a build without git or history has none. */
function latestCommits(): string {
  try {
    return execFileSync('git', ['log', '-n', '5', '--format=%h %s'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

/**
 * Everything the command palette and the terminal know about the site (see `palette-data.ts`). The
 * browser fetches it the first time the palette is opened, not with the page.
 */
export const GET: APIRoute = async () => {
  const notes = sortNotes(await getCollection('notes'));
  const projects = sortProjects(
    (await getCollection('projects')).map((entry) => ({ id: entry.id, ...entry.data })),
  );
  const data = buildPaletteData({
    navLinks: getNavLinks(),
    games: liveGames(games),
    notes: notes.map((note) => ({ id: note.id, data: note.data })),
    projects: projects.map(({ id, ...data }) => ({ id, data })),
    externalLinks: [
      ...socialLinks.map(({ label, href }) => ({ label, href })),
      { label: 'Source code of this site', href: siteConfig.repo },
    ],
    uses: usesSummary,
    commits: parseCommits(latestCommits()),
    site: siteConfig,
    nowItems: now.items,
    formatPeriod,
    notePath,
  });
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
