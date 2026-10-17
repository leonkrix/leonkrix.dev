import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { expectedFingerprints, fileOf, loadCards } from '../../scripts/og-cards';
import { OG_HEIGHT, OG_WIDTH } from '../../src/lib/og';
import { siteConfig } from '../../src/lib/site';
import { distDir, readPages } from './helpers';

/**
 * The preview cards (the pictures that appear when a link is shared): the card of the home page,
 * which every page without a card of its own uses, and a card for every note, every live game, the
 * overviews and the Uses page. They are made by `pnpm og` and committed, so the build does not need
 * a browser; these tests check that they are there, that they are the right size, that they show
 * what is on the pages now (a changed title without new pictures fails) and that every page points
 * to its own card.
 */
const root = join(import.meta.dirname, '..', '..');
const fingerprints = JSON.parse(
  readFileSync(join(root, 'scripts', 'og-fingerprints.json'), 'utf8'),
) as Record<string, string>;
const expected = expectedFingerprints();
const pages = await readPages();

describe('the preview cards', () => {
  it('are made for the content of the pages as it is now (run pnpm og when this fails)', () => {
    for (const [id, fingerprint] of Object.entries(expected)) {
      expect(
        fingerprints[id],
        `the card "${id}" is missing or out of date: a title, a text or the template changed, run "pnpm og" and commit the pictures`,
      ).toBe(fingerprint);
    }
    expect(Object.keys(fingerprints).sort()).toEqual(Object.keys(expected).sort());
  });

  it('have a picture each, 1200 x 630 pixels, small enough for every platform', () => {
    for (const id of Object.keys(expected)) {
      const file = join(distDir, fileOf(id));
      expect(existsSync(file), `${fileOf(id)} is in the build`).toBe(true);
      const png = readFileSync(file);
      // PNG signature, then the IHDR chunk with the width and the height
      expect(png.subarray(0, 8).toString('hex'), id).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16), `${id} width`).toBe(OG_WIDTH);
      expect(png.readUInt32BE(20), `${id} height`).toBe(OG_HEIGHT);
      // WhatsApp shows no preview picture above about 300 KB
      expect(png.byteLength, `${id} is ${String(png.byteLength)} bytes`).toBeLessThan(260 * 1024);
    }
  });

  it('have no picture in the build that belongs to no card', () => {
    const files = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? files(join(directory, entry.name))
          : [`/${relative(distDir, join(directory, entry.name)).replaceAll('\\', '/')}`],
      );
    const wanted = new Set(Object.keys(expected).map(fileOf));
    for (const file of files(join(distDir, 'og'))) {
      expect(wanted.has(file), `${file} belongs to no card`).toBe(true);
    }
  });

  it('say something: a title, a tag and a text, with the address of the page', () => {
    for (const card of loadCards()) {
      expect(card.title.length, card.id).toBeGreaterThan(2);
      expect(card.eyebrow.length, card.id).toBeGreaterThan(0);
      expect(card.text.length, card.id).toBeGreaterThan(20);
      expect(card.address.startsWith(new URL(siteConfig.url).hostname), card.id).toBe(true);
    }
  });
});

describe('what the pages say about their preview picture', () => {
  const meta = (html: string, property: string): string =>
    new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`).exec(html)?.[1] ?? '';

  /** The id of the card of a page: "notes/word-radar" for dist/notes/word-radar/index.html */
  const idOf = (file: string): string | undefined => {
    const route = relative(distDir, file)
      .replaceAll('\\', '/')
      .replace(/\/?index\.html$/, '');
    return ['notes', 'games', 'uses'].includes(route) || /^(notes|games)\/[^/]+$/.test(route)
      ? route
      : undefined;
  };

  it('every page with a card of its own points to it, and every other page to the home card', () => {
    let withCard = 0;
    for (const { file, html } of pages) {
      const id = idOf(file);
      const own = id !== undefined && id in expected;
      const want = `${siteConfig.url}${own ? fileOf(id) : '/og.png'}`;
      if (own) {
        withCard += 1;
      }
      expect(meta(html, 'og:image'), relative(distDir, file)).toBe(want);
      expect(meta(html, 'twitter:image'), relative(distDir, file)).toBe(want);
    }
    // The overviews, the Uses page, every note and every game (all but the home card)
    expect(withCard).toBe(Object.keys(expected).length - 1);
  });

  it('every picture that a page names is in the build', () => {
    for (const { file, html } of pages) {
      const path = new URL(meta(html, 'og:image')).pathname;
      expect(existsSync(join(distDir, path)), `${relative(distDir, file)}: ${path}`).toBe(true);
    }
  });

  it('describes the picture of a card in words, by the title of the page', () => {
    const cards = loadCards();
    for (const { file, html } of pages) {
      const id = idOf(file);
      const alt = meta(html, 'og:image:alt');
      expect(alt.length, relative(distDir, file)).toBeGreaterThan(5);
      expect(meta(html, 'twitter:image:alt'), relative(distDir, file)).toBe(alt);
      if (id?.startsWith('notes/') || id?.startsWith('games/')) {
        const card = cards.find((entry) => entry.id === id);
        expect(alt.startsWith(card?.title ?? '?'), `${id}: ${alt}`).toBe(true);
      }
    }
  });

  it('keeps the size of the picture in the tags', () => {
    for (const { file, html } of pages) {
      expect(meta(html, 'og:image:width'), file).toBe(String(OG_WIDTH));
      expect(meta(html, 'og:image:height'), file).toBe(String(OG_HEIGHT));
    }
  });
});
