import { readFileSync } from 'node:fs';

import { type Page } from '@playwright/test';

import { makeWordData } from '../../src/games/word-radar/logic/data';
import { bucketOf } from '../../src/games/word-radar/logic/radar';
import { pickSecret, startRound } from '../../src/games/word-radar/logic/round';
import AxeBuilder from './axe';
import { expect, gameReady, test } from './fixtures';

const PATH = '/games/word-radar/';
const SEED = 20261013;

// The same data as the game, read from the files, so that the tests know the hidden word and ranks
const folder = new URL('../../src/games/word-radar/data/', import.meta.url);
const read = (name: string): Buffer => readFileSync(new URL(name, folder));
const bytes = read('vectors.bin');
const data = makeWordData(
  read('vocabulary.txt').toString('utf8'),
  new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  read('secrets.txt').toString('utf8'),
);
const round = startRound(data, pickSecret(data, SEED));
const secret = data.words[round.secret] ?? '';
/** The rank of a word in this round */
const rankOf = (word: string): number => round.ranking.rankOf[data.indexOf.get(word) ?? -1] ?? 0;
const format = (rank: number): string => rank.toLocaleString('en-US');
/** A few words of different closeness (not the hidden word) */
const near = data.words[round.ranking.order[24] ?? 0] ?? '';
const middle = data.words[round.ranking.order[600] ?? 0] ?? '';
const far = data.words[round.ranking.order[12_000] ?? 0] ?? '';

async function open(page: Page, query = `seed=${String(SEED)}`): Promise<void> {
  await page.goto(`${PATH}?${query}`);
  await gameReady(page);
  await expect(page.getByLabel('Your guess')).toBeEnabled();
}

async function guess(page: Page, word: string): Promise<void> {
  const input = page.getByLabel('Your guess');
  await input.fill(word);
  await input.press('Enter');
}

const message = (page: Page): ReturnType<Page['locator']> => page.locator('.wr-message');

/** Waits until nothing moves any more (only the radar sweep and the cursor of the logo never stop) */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    (document.querySelector('.wr')?.getAnimations({ subtree: true }) ?? []).every(
      (animation) =>
        animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity,
    ),
  );
}

test.describe('Word Radar', () => {
  test('loads the words and asks for a guess', async ({ page }) => {
    await open(page);
    await expect(message(page)).toContainText('Find the hidden word');
    await expect(page.getByRole('button', { name: 'Guess', exact: true })).toBeDisabled();
    await expect(page.locator('.wr-list .wr-row')).toHaveCount(0);
  });

  test('tells the rank of a guess, and sorts the list by it', async ({ page }) => {
    await open(page);
    await guess(page, far);
    await expect(message(page)).toContainText(`${far}: rank ${format(rankOf(far))}`);
    await guess(page, near);
    await guess(page, middle);
    await expect(message(page)).toContainText(`${middle}: rank ${format(rankOf(middle))}`);
    await expect(message(page)).toContainText(bucketOf(rankOf(middle)).label.toLowerCase());
    const words = await page.locator('.wr-list .wr-word').allInnerTexts();
    expect(words.map((word) => word.replace(/\s*latest$/, ''))).toEqual([near, middle, far]);
    // The newest guess is also shown above the list
    await expect(page.locator('.wr-latest .wr-word')).toContainText(middle);
    await expect(page.getByRole('button', { name: /Your guesses \(3\)/ })).toBeVisible();
  });

  test('refuses words that are unknown, repeated or not words, and keeps the round', async ({
    page,
  }) => {
    await open(page);
    await guess(page, near);
    await guess(page, 'qzxqzxq');
    await expect(message(page)).toContainText('is not in the word list');
    await guess(page, near.toUpperCase());
    await expect(message(page)).toContainText(`You tried ${near} already`);
    await guess(page, 'two words');
    await expect(message(page)).toContainText('Type one word, with letters only');
    await expect(page.locator('.wr-list .wr-row')).toHaveCount(1);
  });

  test('gives hints that come closer, and counts them', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(message(page)).toContainText('Hint:');
    await expect(page.getByRole('button', { name: 'Hint (1)' })).toBeVisible();
    await page.getByRole('button', { name: 'Hint (1)' }).click();
    const ranks = (await page.locator('.wr-list .wr-rank').allInnerTexts()).map((text) =>
      Number(text.replaceAll(',', '')),
    );
    expect(ranks).toHaveLength(2);
    expect(ranks[0]).toBeLessThan(ranks[1] ?? 0);
    await expect(page.locator('.wr-list .wr-tag', { hasText: 'hint' })).toHaveCount(2);
  });

  test('is won with the hidden word, and then shows the map and the nearest words', async ({
    page,
  }) => {
    await open(page);
    await guess(page, middle);
    await guess(page, secret);
    await expect(
      page.getByRole('heading', { name: new RegExp(`Found it! ${secret}`) }),
    ).toBeVisible();
    await expect(page.getByLabel('Your guess')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.wr-map')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nearest words' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The nearest words start with the hidden word, and show which ones were guessed
    await expect(page.locator('.wr-list .wr-row').first()).toContainText(secret);
    await expect(page.locator('.wr-list .wr-row')).toHaveCount(40);
    await page.getByRole('button', { name: 'Radar' }).click();
    await expect(page.locator('.wr-radar')).toBeVisible();
    await page.getByRole('button', { name: /Your guesses/ }).click();
    await expect(page.locator('.wr-list .wr-row')).toHaveCount(2);
  });

  test('asks twice before it gives up, and then shows the word', async ({ page }) => {
    await open(page);
    await guess(page, near);
    await page.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByRole('button', { name: 'Really give up?' })).toBeVisible();
    await expect(page.locator('.wr-result')).toHaveCount(0);
    await page.getByRole('button', { name: 'Really give up?' }).click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`The word was ${secret}`) }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hint' })).toBeDisabled();
  });

  test('can be played with the keyboard', async ({ page }) => {
    await open(page);
    await page.getByLabel('Your guess').focus();
    await page.keyboard.type(near);
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Your guess')).toHaveValue('');
    await page.keyboard.type(near);
    await page.keyboard.press('Enter');
    await expect(page.locator('.wr-list .wr-row')).toHaveCount(1);
    // The field keeps the focus for the next word
    await expect(page.getByLabel('Your guess')).toBeFocused();
  });

  test('opens the same hidden word from its link, and a new one with the button', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: 'Give up' }).click();
    await page.getByRole('button', { name: 'Really give up?' }).click();
    await expect(page.locator('.wr-result strong')).toHaveText(secret);
    await open(page);
    await page.getByRole('button', { name: 'Give up' }).click();
    await page.getByRole('button', { name: 'Really give up?' }).click();
    await expect(page.locator('.wr-result strong')).toHaveText(secret);

    await page.getByRole('button', { name: 'New round' }).click();
    await expect(page.locator('.wr-result')).toHaveCount(0);
    await expect(page.getByLabel('Your guess')).toBeEnabled();
    await expect(page.locator('.wr-list .wr-row')).toHaveCount(0);
  });

  test('moves nothing on the page at any moment of a round', async ({ page, layoutShifts }) => {
    await open(page);
    // Messages of all lengths, guesses until the list has to scroll, a hint, the win
    await guess(page, 'qzxqzxq');
    await guess(page, 'two words');
    await guess(page, far);
    await guess(page, far);
    for (const word of data.words.slice(100, 118)) {
      await guess(page, word);
    }
    await page.getByRole('button', { name: 'Hint' }).click();
    await guess(page, near);
    await guess(page, secret);
    await expect(page.getByRole('heading', { name: /Found it!/ })).toBeVisible();
    await page.getByRole('button', { name: 'Radar' }).click();
    await page.getByRole('button', { name: 'Map' }).click();
    await settled(page);
    expect(layoutShifts).toEqual([]);
  });

  test('moves nothing on the page when giving up, on the narrowest phones', async ({
    page,
    layoutShifts,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    await guess(page, 'qzxqzxq');
    await guess(page, near);
    await page.getByRole('button', { name: 'Give up' }).click();
    await page.getByRole('button', { name: 'Really give up?' }).click();
    await expect(page.getByRole('heading', { name: /The word was/ })).toBeVisible();
    await page.getByRole('button', { name: 'Nearest words' }).click();
    await settled(page);
    expect(layoutShifts).toEqual([]);
  });

  test('stores nothing on the device after a round', async ({ page }) => {
    await open(page);
    await guess(page, near);
    await guess(page, secret);
    await expect(page.getByRole('heading', { name: /Found it!/ })).toBeVisible();
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
    await page.getByRole('button', { name: 'Give up' }).click();
    await page.getByRole('button', { name: 'Really give up?' }).click();
    await expect(page.getByRole('heading', { name: /The word was/ })).toBeVisible();
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});

test.describe('Word Radar with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('plays without any animation', async ({ page }) => {
    await open(page);
    await guess(page, near);
    await guess(page, secret);
    await expect(page.getByRole('heading', { name: /Found it!/ })).toBeVisible();
    expect(
      await page
        .locator('.wr')
        .evaluate((element) => element.getAnimations({ subtree: true }).length),
    ).toBe(0);
  });
});
