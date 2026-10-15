import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { distDir, readPages } from './helpers';

// Pages that are mostly text request their two fonts before the stylesheet is read. Without it the
// text is first set in the fallback font and then again in the real one, it breaks differently and
// the page jumps (Lighthouse measured a layout shift of 0.07 on the notes, and in the continuous
// integration it was enough to fall below the limit). The game pages must NOT do it: their page
// loads a large file at the same time, and the preload made Lighthouse count that download into the
// first paint (a score of 75 instead of 98).

const pages = await readPages();
const route = (file: string): string => relative(distDir, file).split('\\').join('/');
const preloads = (html: string): string[] =>
  [...html.matchAll(/<link rel="preload" href="([^"]+\.woff2)" as="font"[^>]*>/g)].map(
    (match) => match[1] ?? '',
  );

const textPages = pages.filter(({ file }) =>
  /^(notes|legal-notice|privacy-policy|uses)\//.test(route(file)),
);
const gamePages = pages.filter(({ file }) => route(file).startsWith('games/'));

describe('font preload', () => {
  it('is on the pages that are mostly text, with both fonts, and the files exist', () => {
    expect(textPages.length).toBeGreaterThan(0);
    for (const { file, html } of textPages) {
      const fonts = preloads(html);
      expect(fonts, route(file)).toHaveLength(2);
      expect(
        fonts.some((font) => font.includes('inter-')),
        route(file),
      ).toBe(true);
      expect(
        fonts.some((font) => font.includes('jetbrains-mono-')),
        route(file),
      ).toBe(true);
      for (const font of fonts) {
        expect(existsSync(join(distDir, font)), `${route(file)}: ${font}`).toBe(true);
      }
    }
  });

  it('is not on the game pages (see the comment at the top of this file)', () => {
    expect(gamePages.length).toBeGreaterThan(0);
    for (const { file, html } of gamePages) {
      expect(preloads(html), route(file)).toEqual([]);
    }
  });
});
