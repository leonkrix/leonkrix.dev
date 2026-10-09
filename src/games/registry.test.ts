import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import lucide from '@iconify-json/lucide/icons.json';
import { describe, expect, it } from 'vitest';

import { resolveIcon } from '../lib/icons';
import {
  type GameDefinition,
  gamePath,
  gamePaths,
  games,
  gamesPath,
  type GameTag,
  liveGames,
} from './registry';

const gamesDirectory = import.meta.dirname;
const tags: readonly GameTag[] = ['Words', 'Logic', 'ML', 'Network'];

function game(slug: string, status: GameDefinition['status']): GameDefinition {
  return {
    slug,
    name: slug,
    tag: 'Logic',
    description: 'A test game.',
    icon: 'lucide:puzzle',
    status,
  };
}

describe('registry data', () => {
  it('has unique slugs, written as lowercase words joined by hyphens', () => {
    const slugs = games.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug, slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });

  it('has unique names, a known tag, and a one-line description', () => {
    const names = games.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    for (const entry of games) {
      expect(tags, entry.slug).toContain(entry.tag);
      expect(entry.description, entry.slug).toMatch(/^[A-Z].*[.!?]$/);
      expect(entry.description.length, entry.slug).toBeLessThanOrEqual(90);
    }
  });

  it('uses icons that exist', () => {
    for (const entry of games) {
      expect(() => resolveIcon({ lucide }, entry.icon), entry.slug).not.toThrow();
    }
  });
});

describe('game folders', () => {
  const folders = readdirSync(gamesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => entry.name);

  it('has a registry entry for every game folder', () => {
    const slugs = games.map((entry) => entry.slug);
    for (const folder of folders) {
      expect(slugs, `folder src/games/${folder}`).toContain(folder);
    }
  });

  it('has a README in every game folder', () => {
    for (const folder of folders) {
      expect(existsSync(join(gamesDirectory, folder, 'README.md')), folder).toBe(true);
    }
  });

  it('has a page component, a tile preview and a README for every live game', () => {
    for (const entry of liveGames()) {
      for (const file of ['GamePage.astro', 'Preview.astro', 'README.md']) {
        expect(existsSync(join(gamesDirectory, entry.slug, file)), `${entry.slug}/${file}`).toBe(
          true,
        );
      }
    }
  });
});

describe('liveGames and gamePaths', () => {
  const list = [game('first-game', 'live'), game('second-game', 'hidden'), game('third', 'live')];

  it('keeps only live games, in order', () => {
    expect(liveGames(list).map((entry) => entry.slug)).toEqual(['first-game', 'third']);
  });

  it('gives the overview and one page per live game', () => {
    expect(gamePaths(list)).toEqual([gamesPath, '/games/first-game/', '/games/third/']);
    expect(gamePath('third')).toBe('/games/third/');
  });

  it('gives no pages at all while no game is live', () => {
    expect(gamePaths([game('hidden-one', 'hidden')])).toEqual([]);
    expect(gamePaths([])).toEqual([]);
  });
});
