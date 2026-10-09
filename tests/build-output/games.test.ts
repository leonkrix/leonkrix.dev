import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { gamePath, gamePaths, liveGames } from '../../src/games/registry';
import { distDir, readDistFile } from './helpers';

/**
 * The Playground exists exactly while at least one game is live: section, navigation entry,
 * overview, one page per game and the sitemap entries all appear and disappear together.
 */
const live = liveGames();
const pageFile = (path: string): string => join(distDir, path, 'index.html');

describe('playground', () => {
  it('builds the overview and one page per live game, and nothing else', () => {
    expect(existsSync(pageFile('games'))).toBe(live.length > 0);
    for (const game of live) {
      expect(existsSync(pageFile(gamePath(game.slug))), game.slug).toBe(true);
    }
    const games = ['tech-words', 'root-cause', 'word-radar', 'link-up'];
    for (const slug of games.filter((slug) => !live.some((game) => game.slug === slug))) {
      expect(existsSync(pageFile(gamePath(slug))), `hidden game ${slug}`).toBe(false);
    }
  });

  it('shows the section and the navigation entry on the home page only with a live game', async () => {
    const home = await readDistFile('index.html');
    expect(home.includes('<section id="playground"')).toBe(live.length > 0);
    expect(home.includes('href="/#playground"')).toBe(live.length > 0);
    // The contact section is numbered after the playground
    expect(home).toContain(live.length > 0 ? '05 /' : '04 /');
    expect(home.includes('05 /')).toBe(live.length > 0);
  });

  it('lists exactly the playground pages in the sitemap', async () => {
    const sitemap = await readDistFile('sitemap.xml');
    const found = [...sitemap.matchAll(/<loc>https:\/\/leonkrix\.dev(\/games[^<]*)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(found).toEqual([...gamePaths()].sort());
  });

  it('gives every game page a title, a description and a link back to the overview', async () => {
    for (const game of live) {
      const html = await readDistFile(join(gamePath(game.slug), 'index.html'));
      expect(html, game.slug).toContain(`<title>${game.name} | Leon Krix</title>`);
      expect(html, game.slug).toContain('href="/games/"');
      expect(html, game.slug).toContain('<h1');
    }
  });
});
