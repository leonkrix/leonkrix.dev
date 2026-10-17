/**
 * Generates the Open Graph preview images (the cards that appear when a link is shared), 1200 x 630
 * pixels: the card of the home page (public/og.png, also used by every page without a card of its
 * own) and a card for every note, every live game and the overviews and the Uses page
 * (public/og/<id>.png). A card is a screenshot of a small HTML page (scripts/og-template.ts) that
 * uses the same fonts, colors and wordmark as the site, rendered with the Chromium that Playwright
 * already provides, so it needs no extra dependency. The pictures are committed: a build must not
 * depend on a browser.
 *
 * Only the cards whose content (or the template) changed are made again; the fingerprint of every
 * picture is in scripts/og-fingerprints.json, and tests/build-output/og.test.ts fails when a
 * picture is out of date or missing. Run it after changing a title or a summary of a note, a game
 * or the template, and commit the result.
 *
 * Usage: pnpm og          (the cards that changed)
 *        pnpm og --all    (every card, also the ones that did not change)
 *        Needs the Playwright browser: pnpm exec playwright install chromium
 */
import { mkdir, mkdtemp, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import { OG_HEIGHT, OG_WIDTH } from '../src/lib/og.ts';
import { expectedFingerprints, fileOf, homeCard, loadCards } from './og-cards.ts';
import { cardHtml, homeHtml } from './og-template.ts';

const FINGERPRINTS = resolve('scripts', 'og-fingerprints.json');
const all = process.argv.includes('--all');

const fontUrl = (name) =>
  pathToFileURL(resolve('node_modules', '@fontsource-variable', ...name.split('/'))).href;
const fonts = {
  inter: fontUrl('inter/files/inter-latin-wght-normal.woff2'),
  mono: fontUrl('jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'),
};

const expected = expectedFingerprints();
let known = {};
try {
  known = JSON.parse(await readFile(FINGERPRINTS, 'utf8'));
} catch {
  // the first time there is none
}

const cards = new Map(loadCards().map((card) => [card.id, card]));
const exists = async (file) => {
  try {
    await stat(resolve('public', `.${file}`));
    return true;
  } catch {
    return false;
  }
};

const todo = [];
for (const [id, fingerprint] of Object.entries(expected)) {
  if (all || known[id] !== fingerprint || !(await exists(fileOf(id)))) {
    todo.push(id);
  }
}

const directory = await mkdtemp(join(tmpdir(), 'og-'));
const made = [];
if (todo.length > 0) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: OG_WIDTH, height: OG_HEIGHT },
      deviceScaleFactor: 1,
    });
    const tab = await context.newPage();
    for (const id of todo) {
      const card = cards.get(id);
      const html =
        id === 'home'
          ? homeHtml(fonts, homeCard.name, homeCard.role, homeCard.address)
          : cardHtml(fonts, card);
      const file = join(directory, 'card.html');
      await writeFile(file, html, 'utf8');
      await tab.goto(pathToFileURL(file).href);
      // Make sure both fonts are loaded before the picture is taken
      await tab.evaluate(() => document.fonts.ready);
      // A title or a text that does not fit must be changed: no card is made with a cut-off title
      const problem = await tab.evaluate(() => {
        const title = document.querySelector('.title');
        // Lines of the title: its height by the height of a line (the letters reach a little out of it)
        if (
          title &&
          title.scrollHeight / (parseFloat(getComputedStyle(title).fontSize) * 1.08) > 3.5
        ) {
          return 'the title does not fit in three lines';
        }
        const frame = document.querySelector('.frame');
        if (frame && frame.scrollHeight > frame.clientHeight + 1) {
          return 'the card has more on it than fits';
        }
        return '';
      });
      if (problem) {
        throw new Error(`Card "${id}": ${problem}. Shorten the title or the text.`);
      }
      const output = resolve('public', `.${fileOf(id)}`);
      await mkdir(dirname(output), { recursive: true });
      await tab.screenshot({ path: output, type: 'png' });
      const { size } = await stat(output);
      made.push(`${fileOf(id)}  ${String(Math.round(size / 1024))} KB`);
    }
  } finally {
    await browser.close();
  }
}
await rm(directory, { recursive: true, force: true });

// Pictures of cards that are gone (a note that was deleted) do not stay behind
const published = new Set(Object.keys(expected).map(fileOf));
const removed = [];
async function sweep(folder, prefix) {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await sweep(join(folder, entry.name), path);
    } else if (!published.has(path)) {
      await unlink(join(folder, entry.name));
      removed.push(path);
    }
  }
}
await sweep(resolve('public', 'og'), '/og');

const sorted = Object.fromEntries(Object.entries(expected).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(FINGERPRINTS, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

process.stdout.write(
  made.length === 0 && removed.length === 0
    ? `All ${String(Object.keys(expected).length)} cards are up to date.\n`
    : `${made.map((line) => `made     ${line}`).join('\n')}${made.length > 0 ? '\n' : ''}${removed
        .map((path) => `removed  ${path}`)
        .join('\n')}${removed.length > 0 ? '\n' : ''}`,
);
