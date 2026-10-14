import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { gamePath, games } from '../../src/games/registry';
import { notePath, noteSchema, notesPath } from '../../src/lib/notes';
import { readDistFile } from './helpers';

/**
 * The notes ("Behind the scenes"): one MDX file in src/content/notes per page, an overview that
 * lists them, links from the games they are about and from the sitemap.
 */
const folder = join(import.meta.dirname, '..', '..', 'src', 'content', 'notes');
const files = readdirSync(folder).filter((name) => name.endsWith('.mdx'));

interface Source {
  slug: string;
  front: Record<string, string>;
  text: string;
}

/** The front matter of a note, as far as these tests need it: `key: value` lines */
function read(name: string): Source {
  const text = readFileSync(join(folder, name), 'utf8');
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
  const front: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const match = /^(\w+):\s*(.*)$/.exec(line);
    if (match?.[1] !== undefined) {
      front[match[1]] = (match[2] ?? '').replace(/^'(.*)'$/, '$1');
    }
  }
  return { slug: name.replace(/\.mdx$/, ''), front, text };
}

const notes = files.map(read);

describe('notes', () => {
  it('has the files and the front matter that the schema wants', () => {
    expect(notes.length).toBeGreaterThan(0);
    for (const { slug, front } of notes) {
      const result = noteSchema.safeParse({ ...front, order: Number(front.order) });
      expect(result.error?.message, slug).toBeUndefined();
    }
  });

  it('has a different place on the overview for every note', () => {
    const orders = notes.map(({ front }) => front.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('belongs to games that exist and are live, and the game page links back', async () => {
    for (const { slug, front } of notes) {
      const slugOfGame = front.game;
      if (slugOfGame === undefined) {
        continue;
      }
      const game = games.find((one) => one.slug === slugOfGame);
      expect(game?.status, `${slug}: game ${slugOfGame}`).toBe('live');
      const page = await readDistFile(join(gamePath(slugOfGame), 'index.html'));
      expect(page, `${slugOfGame} links to its note`).toContain(`href="${notePath(slug)}"`);
    }
  });

  it('points to a folder of the code that exists', () => {
    for (const { slug, front } of notes) {
      const code = front.code;
      if (code !== undefined) {
        expect(() => readdirSync(join(import.meta.dirname, '..', '..', code)), slug).not.toThrow();
      }
    }
  });
});

describe('notes in the build', () => {
  it('lists every note on the overview and in the sitemap', async () => {
    const overview = await readDistFile(join(notesPath, 'index.html'));
    const sitemap = await readDistFile('sitemap.xml');
    expect(sitemap).toContain(`https://leonkrix.dev${notesPath}</loc>`);
    for (const { slug, front } of notes) {
      expect(overview, slug).toContain(`href="${notePath(slug)}"`);
      expect(overview, slug).toContain(front.title?.replace(/&/g, '&amp;') ?? '?');
      expect(sitemap, slug).toContain(`https://leonkrix.dev${notePath(slug)}</loc>`);
    }
  });

  it('has one heading of level 1, a link back, and nothing from another site', async () => {
    for (const { slug } of notes) {
      const html = await readDistFile(join(notePath(slug), 'index.html'));
      expect(html.match(/<h1[\s>]/g)?.length, slug).toBe(1);
      expect(html, slug).toContain(`href="${notesPath}"`);
      // The figures describe themselves for assistive technology
      for (const svg of html.matchAll(/<svg[^>]*>/g)) {
        const tag = svg[0];
        expect(
          tag.includes('role="img"') || tag.includes('aria-hidden="true"'),
          `${slug}: ${tag}`,
        ).toBe(true);
      }
    }
  });

  it('links to the code on GitHub for a note with a folder', async () => {
    for (const { slug, front } of notes) {
      if (front.code === undefined) {
        continue;
      }
      const html = await readDistFile(join(notePath(slug), 'index.html'));
      expect(html, slug).toContain(
        `href="https://github.com/leonkrix/leonkrix.dev/tree/main/${front.code}"`,
      );
    }
  });
});

describe('the highlights of the projects', () => {
  it('show the links to this site as links', async () => {
    const home = await readDistFile('index.html');
    expect(home).toContain('href="/notes/"');
    // The text of a link is shown, never the markup of it
    expect(home).not.toMatch(/\]\(\//);
  });
});
