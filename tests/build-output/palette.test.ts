import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { liveGames } from '../../src/games/registry';
import { decodeEmail } from '../../src/lib/palette';
import type { PaletteData } from '../../src/lib/palette-data';
import { siteConfig } from '../../src/lib/site';
import { distDir, readDistFile, readPages } from './helpers';

/**
 * The command palette and its terminal: `/palette.json` is made from the real content, and the
 * code and styles of the palette are fetched only when it is opened, so no page may link them.
 */
async function readData(): Promise<PaletteData> {
  return JSON.parse(await readDistFile('palette.json')) as PaletteData;
}

describe('palette.json', () => {
  it('lists every live game, every note and every project of the site', async () => {
    const data = await readData();
    expect(data.games.map((game) => game.slug).sort()).toEqual(
      liveGames()
        .map((game) => game.slug)
        .sort(),
    );
    const noteFiles = readdirSync(join(distDir, 'notes'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(data.notes.map((note) => note.slug).sort()).toEqual(noteFiles);
    expect(data.projects.length).toBeGreaterThan(0);
    expect(data.uses.length).toBeGreaterThan(0);
  });

  it('only points to pages and anchors that exist', async () => {
    const data = await readData();
    const home = await readDistFile('index.html');
    const internal = [
      ...data.places,
      ...data.games,
      ...data.notes,
      ...data.projects,
      ...data.legal,
    ].map((entry) => entry.href);
    for (const href of internal) {
      expect(href, href).toMatch(/^\//);
      const [path = '', anchor] = href.split('#');
      const file = path === '/' || path === '' ? 'index.html' : join(path, 'index.html');
      const exists = existsSync(join(distDir, file)) || existsSync(join(distDir, path));
      expect(exists, `${href} has no page`).toBe(true);
      if (anchor !== undefined) {
        expect(home, `${href} has no anchor`).toContain(`id="${anchor}"`);
      }
    }
    for (const link of data.links) {
      expect(link.href).toMatch(/^https:\/\//);
    }
  });

  it('keeps the email address out of readable text, and can give it back', async () => {
    const text = await readDistFile('palette.json');
    expect(text).not.toContain(siteConfig.email);
    expect(text).not.toContain('mailto:');
    expect(decodeEmail((await readData()).email)).toBe(siteConfig.email);
  });

  it('has the commits it was built with, or none, and never more than five', async () => {
    const { commits } = await readData();
    expect(commits.length).toBeLessThanOrEqual(5);
    for (const { hash, subject } of commits) {
      expect(hash).toMatch(/^[0-9a-f]{7,}$/);
      expect(subject.length).toBeGreaterThan(0);
    }
  });
});

describe('what a page carries of the palette', () => {
  it('never links the styles or the code of the palette, the terminal and the sweep', async () => {
    const pages = await readPages();
    expect(pages.length).toBeGreaterThan(5);
    for (const { file, html } of pages) {
      // The 404 page has the lines of its terminal in the page, so it links the styles of the lines
      const links = [...html.matchAll(/(?:href|src)="([^"]*_astro\/[^"]+)"/g)].map(
        (match) => match[1] ?? '',
      );
      for (const link of links) {
        expect(link, `${file} loads ${link} with the page`).not.toMatch(
          /palette-ui|terminal-ui|sweep|\/palette\.[^/]*\.css/,
        );
      }
    }
  });

  it('puts the small script that opens the palette on every page, with a button', async () => {
    const pages = await readPages();
    for (const { file, html } of pages) {
      expect(html, file).toContain('data-palette-open');
    }
  });

  it('keeps the charset within the first 1024 bytes, after the greeting for readers of the source', async () => {
    const pages = await readPages();
    for (const { file, html } of pages) {
      const at = Buffer.from(html).indexOf('<meta charset');
      expect(at, file).toBeGreaterThan(-1);
      expect(at, file).toBeLessThan(1024);
      expect(html, file).toMatch(/^<!DOCTYPE html><!--[\s\S]*?-->/);
      expect(html.slice(0, 600), file).toContain(siteConfig.repo);
    }
  });
});
