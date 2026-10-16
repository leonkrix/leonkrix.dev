import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { distDir, readPages } from './helpers';

// Every page requests its two fonts (Inter and JetBrains Mono, the latin files) at once, before the
// stylesheet is read. Without it the text is first set in the fallback font, then again in the real
// one when the font arrives; it breaks differently and the page jumps (Lighthouse measured a layout
// shift of 0.07 on the notes, and on the slower machine of the continuous integration it was enough
// to fall below the limit; the layout guard saw the overview of the games jump by 28 px when the
// fonts came late).
//
// Why this is for the game pages too: it used to be left out of them, because the preload made
// Lighthouse count the 2 MB download of Word Radar into the first paint (a score of 75 instead of
// 98). That was a different problem that the preload only made visible: the largest paint of that
// page depended on the download. It does not any more (see `afterPaint` in
// src/games/word-radar/data/load.ts and the comment of WordRadarSkeleton), so there is no reason
// for an exception, and the same rule holds for every page.

const pages = await readPages();
const route = (file: string): string => relative(distDir, file).split('\\').join('/');
const preloads = (html: string): string[] =>
  [...html.matchAll(/<link rel="preload" href="([^"]+\.woff2)" as="font"[^>]*>/g)].map(
    (match) => match[1] ?? '',
  );

describe('font preload', () => {
  it('is on every page, with both fonts, and the files exist', () => {
    expect(pages.length).toBeGreaterThan(10);
    for (const { file, html } of pages) {
      const fonts = preloads(html);
      expect(fonts, route(file)).toHaveLength(2);
      expect(
        fonts.some((font) => font.includes('inter-latin-wght')),
        route(file),
      ).toBe(true);
      expect(
        fonts.some((font) => font.includes('jetbrains-mono-latin-wght')),
        route(file),
      ).toBe(true);
      for (const font of fonts) {
        expect(existsSync(join(distDir, font)), `${route(file)}: ${font}`).toBe(true);
      }
    }
  });

  it('comes before the stylesheet, as a font with the attributes the browser needs to reuse it', () => {
    for (const { file, html } of pages) {
      const firstPreload = html.indexOf('rel="preload"');
      const firstStyle = Math.min(
        ...['<link rel="stylesheet"', '<style'].map((start) => {
          const at = html.indexOf(start);
          return at < 0 ? Number.MAX_SAFE_INTEGER : at;
        }),
      );
      expect(firstPreload, route(file)).toBeGreaterThan(-1);
      expect(firstPreload, `${route(file)}: the preload is after the first style`).toBeLessThan(
        firstStyle,
      );
      // A font is fetched in "anonymous" mode: without crossorigin the preloaded file is not used
      for (const link of html.match(/<link rel="preload"[^>]*>/g) ?? []) {
        expect(link, route(file)).toContain('crossorigin');
        expect(link, route(file)).toContain('type="font/woff2"');
      }
    }
  });

  it('does not preload anything else, so the first request goes to what the page needs most', () => {
    for (const { file, html } of pages) {
      expect(html.match(/<link rel="preload"/g) ?? [], route(file)).toHaveLength(2);
    }
  });
});
