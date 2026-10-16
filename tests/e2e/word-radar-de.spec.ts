import { readFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';

import { makeWordData } from '../../src/games/word-radar/logic/data';
import { bucketOf } from '../../src/games/word-radar/logic/radar';
import { pickSecret, startRound } from '../../src/games/word-radar/logic/round';
import { texts } from '../../src/games/word-radar/logic/texts';
import { expect, gameReady, test } from './fixtures';

// Word Radar in German: the language is chosen by the address (?lang=de), the game is the same
// component with German texts and the German data files. These tests play a round in German and
// look at the switch, the numbers, the typing of umlauts and that nothing moves.

const PATH = '/games/word-radar/';
const SEED = 20261015;
const de = texts.de;

const folder = new URL('../../src/games/word-radar/data/de/', import.meta.url);
const read = (name: string): Buffer => readFileSync(new URL(name, folder));
const bytes = read('vectors.bin');
const data = makeWordData(
  read('vocabulary.txt').toString('utf8'),
  new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  read('secrets.txt').toString('utf8'),
  'de',
  read('forms.txt').toString('utf8'),
);
const round = startRound(data, pickSecret(data, SEED));
const secret = data.words[round.secret] ?? '';
const rankOf = (word: string): number =>
  round.ranking.rankOf[data.indexOf.get(word.toLowerCase()) ?? -1] ?? 0;
/** German numbers have a dot between the thousands */
const format = (rank: number): string => rank.toLocaleString('de-DE');
const near = data.words[round.ranking.order[24] ?? 0] ?? '';
const middle = data.words[round.ranking.order[600] ?? 0] ?? '';
const far = data.words[round.ranking.order[12_000] ?? 0] ?? '';

async function open(page: Page, query = `lang=de&seed=${String(SEED)}`): Promise<void> {
  await page.goto(`${PATH}?${query}`);
  await gameReady(page);
  await expect(page.getByLabel(de.guessLabel)).toBeEnabled();
}

async function guess(page: Page, word: string): Promise<void> {
  const input = page.getByLabel(de.guessLabel);
  await input.fill(word);
  await input.press('Enter');
}

const message = (page: Page): ReturnType<Page['locator']> => page.locator('.wr-message');

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    (document.querySelector('.wr')?.getAnimations({ subtree: true }) ?? []).every(
      (animation) =>
        animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity,
    ),
  );
}

test.describe('Word Radar in German', () => {
  test('has a switch of the language, plain links that mark the language that is played', async ({
    page,
  }) => {
    await page.goto(PATH);
    await gameReady(page);
    const nav = page.getByRole('navigation', { name: /Language/ });
    // The language that is played is marked and not a link (a click would load the same page again,
    // see word-radar-language.spec.ts); the other one is a link
    const english = nav.locator('[data-wr-lang="en"]');
    const german = nav.locator('[data-wr-lang="de"]');
    await expect(german).toHaveAttribute('href', '?lang=de');
    await expect(english).toHaveAttribute('aria-current', 'true');
    await expect(english).not.toHaveAttribute('href');
    await expect(page.getByLabel('Your guess')).toBeEnabled();

    await nav.getByRole('link', { name: 'Deutsch' }).click();
    await expect(page).toHaveURL(/\?lang=de$/);
    await gameReady(page);
    await expect(page.getByLabel(de.guessLabel)).toBeEnabled();
    await expect(german).toHaveAttribute('aria-current', 'true');
    await expect(german).not.toHaveAttribute('href');
    await expect(english).toHaveAttribute('href', '?lang=en');
    await expect(page.locator('.wr')).toHaveAttribute('lang', 'de');
    await expect(message(page)).toContainText('Finde das versteckte Wort');

    await nav.getByRole('link', { name: 'English' }).click();
    await gameReady(page);
    await expect(page.getByLabel('Your guess')).toBeEnabled();
    await expect(page.locator('.wr')).toHaveAttribute('lang', 'en');
  });

  test('loads only the German files, and the English game still loads only the English ones', async ({
    page,
  }) => {
    const loaded: string[] = [];
    page.on('response', (response) => {
      if (/\/_astro\/.*\.bin$/.test(response.url())) {
        loaded.push(response.url());
      }
    });
    await open(page);
    expect(loaded).toHaveLength(1);
    const sizes = await Promise.all(
      loaded.map(async (url) => (await (await page.request.get(url)).body()).length),
    );
    // 30,000 words with 64 numbers each, the same for both languages: the two files differ by name
    expect(sizes).toEqual([30_000 * 64]);
    const german = loaded[0];

    loaded.length = 0;
    await page.goto(PATH);
    await gameReady(page);
    await expect(page.getByLabel('Your guess')).toBeEnabled();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).not.toBe(german);
  });

  test('tells the rank of a guess in German, with the German number format', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: de.guessButton, exact: true })).toBeDisabled();
    await guess(page, far);
    await expect(message(page)).toContainText(`${far}: Rang ${format(rankOf(far))}`);
    await guess(page, near);
    await guess(page, middle);
    await expect(message(page)).toContainText(`${middle}: Rang ${format(rankOf(middle))}`);
    await expect(message(page)).toContainText(de.bucket[bucketOf(rankOf(middle)).id].toLowerCase());
    const words = await page.locator('.wr-list .wr-word').allInnerTexts();
    expect(words.map((word) => word.replace(/\s*neu$/, ''))).toEqual([near, middle, far]);
    await expect(page.getByRole('button', { name: /Deine Tipps \(3\)/ })).toBeVisible();
  });

  test('finds a word in any case, typed without umlauts and the sharp s, and a form counts as its word', async ({
    page,
  }) => {
    await open(page);
    // Äpfel is a form of Apfel, typed the long way and in capitals
    await guess(page, 'AEPFEL');
    await expect(message(page)).toContainText('AEPFEL zählt als Apfel: Rang');
    await guess(page, 'koenig');
    await expect(message(page)).toContainText('König: Rang');
    await guess(page, 'hunde');
    await expect(message(page)).toContainText('hunde zählt als Hund: Rang');
    await guess(page, 'HUNDE');
    await expect(message(page)).toContainText('Hund hast du schon versucht');
    // the list has the words, not the forms
    const rows = await page.locator('.wr-list .wr-word').allInnerTexts();
    expect(rows.map((row) => row.replace(/\s*neu$/, '')).sort()).toEqual([
      'Apfel',
      'Hund',
      'König',
    ]);
  });

  test('finds the hidden word with a form of it and with a word that means the same', async ({
    page,
  }) => {
    // A round whose hidden word has synonyms, and a form of the hidden word
    const seed = Array.from({ length: 2000 }, (_, step) => SEED + step).find((candidate) =>
      data.aliases.has(pickSecret(data, candidate)),
    );
    expect(seed).toBeDefined();
    const hidden = pickSecret(data, seed ?? SEED);
    const hiddenWord = data.words[hidden] ?? '';
    const synonym = data.words[[...(data.aliases.get(hidden) ?? [])][0] ?? 0] ?? '';
    const form = [...data.forms].find(([, index]) => index === hidden)?.[0];

    await open(page, `lang=de&seed=${String(seed)}`);
    await guess(page, synonym);
    await expect(message(page)).toContainText(`${synonym} bedeutet dasselbe: Gefunden!`);
    await expect(message(page)).toContainText(`Das Wort ist ${hiddenWord}`);
    await expect(
      page.getByRole('heading', { name: new RegExp(`Gefunden! ${hiddenWord}`) }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Deine Tipps/ }).click();
    await expect(page.locator('.wr-list .wr-tag', { hasText: 'dasselbe Wort' })).toHaveCount(1);

    if (form !== undefined) {
      await open(page, `lang=de&seed=${String(seed)}`);
      await guess(page, form);
      await expect(message(page)).toContainText(`${form} zählt als ${hiddenWord}. Gefunden!`);
    }
  });

  test('refuses words that are unknown or not words, in German', async ({ page }) => {
    await open(page);
    await guess(page, 'qzxqzxq');
    await expect(message(page)).toContainText('steht nicht in der Wortliste');
    await guess(page, 'zwei wörter');
    await expect(message(page)).toContainText('Gib ein Wort ein, nur mit Buchstaben');
    await guess(page, 'hund123');
    await expect(message(page)).toContainText('Gib ein Wort ein, nur mit Buchstaben');
    await expect(page.locator('.wr-list .wr-row')).toHaveCount(0);
  });

  test('gives hints, is won with the hidden word and shows the map and the nearest words', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: 'Hinweis' }).click();
    await expect(message(page)).toContainText('Hinweis:');
    await expect(page.getByRole('button', { name: 'Hinweis (1)' })).toBeVisible();
    await guess(page, secret);
    await expect(
      page.getByRole('heading', { name: new RegExp(`Gefunden! ${secret}`) }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: de.map })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: de.nearestWords })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.wr-list .wr-row').first()).toContainText(secret);
    await expect(page.locator('.wr-list .wr-row')).toHaveCount(40);
  });

  test('asks twice before it gives up, and then shows the word', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: de.giveUp }).click();
    await expect(page.getByRole('button', { name: de.reallyGiveUp })).toBeVisible();
    await page.getByRole('button', { name: de.reallyGiveUp }).click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`Das Wort war ${secret}`) }),
    ).toBeVisible();
  });

  test('opens the same hidden word from its link', async ({ page }) => {
    for (let time = 0; time < 2; time += 1) {
      await open(page);
      await page.getByRole('button', { name: de.giveUp }).click();
      await page.getByRole('button', { name: de.reallyGiveUp }).click();
      await expect(page.locator('.wr-result strong')).toHaveText(secret);
    }
  });

  test('moves nothing on the page at any moment of a round', async ({ page, layoutShifts }) => {
    await open(page);
    await guess(page, 'qzxqzxq');
    await guess(page, 'zwei wörter');
    await guess(page, far);
    await guess(page, far);
    for (const word of data.words.slice(100, 118)) {
      await guess(page, word);
    }
    await page.getByRole('button', { name: 'Hinweis' }).click();
    await guess(page, near);
    await guess(page, secret);
    await expect(page.getByRole('heading', { name: /Gefunden!/ })).toBeVisible();
    await page.getByRole('button', { name: de.radar }).click();
    await page.getByRole('button', { name: de.map }).click();
    await settled(page);
    expect(layoutShifts).toEqual([]);
  });

  test('moves nothing on the narrowest phones, also when the page opens in German', async ({
    page,
    layoutShifts,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    await guess(page, near);
    await page.getByRole('button', { name: de.giveUp }).click();
    await page.getByRole('button', { name: de.reallyGiveUp }).click();
    await expect(page.getByRole('heading', { name: /Das Wort war/ })).toBeVisible();
    await page.getByRole('button', { name: de.nearestWords }).click();
    await settled(page);
    expect(layoutShifts).toEqual([]);
  });

  test('stores nothing on the device after a round', async ({ page }) => {
    await open(page);
    await guess(page, near);
    await guess(page, secret);
    await expect(page.getByRole('heading', { name: /Gefunden!/ })).toBeVisible();
    const stored = await page.evaluate(async () => ({
      localStorage: localStorage.length,
      sessionStorage: sessionStorage.length,
      indexedDB: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
    }));
    expect(stored).toEqual({ localStorage: 0, sessionStorage: 0, indexedDB: 0, caches: 0 });
  });

  test('has no accessibility violations while playing and at the end', async ({ page }) => {
    await open(page);
    await guess(page, near);
    await guess(page, far);
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: de.giveUp }).click();
    await page.getByRole('button', { name: de.reallyGiveUp }).click();
    await expect(page.getByRole('heading', { name: /Das Wort war/ })).toBeVisible();
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
