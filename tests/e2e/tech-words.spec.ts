import AxeBuilder from '@axe-core/playwright';
import { type Locator, type Page } from '@playwright/test';

import { createRandom } from '../../src/games/shared/random';
import { techCategoryLabels, type TechTerm } from '../../src/games/shared/tech-term';
import { terms3 } from '../../src/games/tech-words/data/terms-3';
import { terms4 } from '../../src/games/tech-words/data/terms-4';
import { terms5 } from '../../src/games/tech-words/data/terms-5';
import { evaluateGuess } from '../../src/games/tech-words/logic/evaluate';
import { type CategoryChoice, selectTerm } from '../../src/games/tech-words/logic/select';
import { expect, test } from './fixtures';

const PATH = '/games/tech-words/';

/** The term a seed leads to, computed with the same code as the game. */
function answerFor(
  seed: string,
  terms: readonly TechTerm[],
  category: CategoryChoice = 'all',
): TechTerm {
  return selectTerm(terms, category, createRandom(seed));
}

/** A term of the same list that is not the answer. */
function otherThan(answer: TechTerm, terms: readonly TechTerm[], skip = 0): string {
  const candidates = terms.filter(({ term }) => term !== answer.term);
  const candidate = candidates[skip];
  if (candidate === undefined) {
    throw new Error('not enough terms');
  }
  return candidate.term;
}

async function openRound(page: Page, query: string): Promise<void> {
  await page.goto(`${PATH}?${query}`);
  await expect(page.getByRole('grid', { name: 'Your guesses' })).toBeVisible();
}

async function play(page: Page, word: string): Promise<void> {
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
}

const rows = (page: Page) => page.getByRole('row');

test.describe('Tech Words', () => {
  test('plays a round with the keyboard: a wrong term, then the right one', async ({ page }) => {
    const answer = answerFor('e2e-win', terms5);
    const wrong = otherThan(answer, terms5, 3);
    await openRound(page, 'seed=e2e-win');

    await play(page, wrong);
    const first = rows(page).first().getByRole('gridcell');
    const expected = evaluateGuess(wrong, answer.term);
    for (const [index, state] of expected.entries()) {
      await expect(first.nth(index)).toHaveAttribute('data-state', state);
    }
    // The keyboard shows what was learned
    const key = page.getByRole('button', { name: new RegExp(`^${wrong.charAt(0)}(,|$)`) });
    await expect(key).toHaveAttribute('data-state', expected[0] ?? 'absent');

    await play(page, answer.term);
    const result = page.locator('.tw-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Solved in 2 of 6 tries');
    await expect(result).toContainText(answer.term);
    await expect(result).toContainText(answer.definition);
    await expect(result).toContainText(techCategoryLabels[answer.category]);
    await expect(page.getByRole('status')).toContainText('You found it');
  });

  test('refuses a word that is not in the list and does not use up the try', async ({ page }) => {
    await openRound(page, 'seed=e2e-refuse');

    await play(page, 'zzzzz');
    await expect(page.locator('.tw-toast')).toContainText('Not in the word list');
    await expect(page.getByRole('status')).toHaveText('Not in the word list');
    const first = rows(page).first();
    await expect(first).toHaveAttribute('data-shake', /^[ab]$/);
    // The letters stay, so they can be corrected, and no tile has a result
    await expect(first.getByRole('gridcell').first()).toHaveAttribute('data-state', 'typed');

    for (let index = 0; index < 5; index += 1) {
      await page.keyboard.press('Backspace');
    }
    await page.keyboard.type('abc');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText('Not enough letters');
  });

  test('ends the round after six wrong guesses and shows the term', async ({ page }) => {
    const answer = answerFor('e2e-lose', terms5);
    await openRound(page, 'seed=e2e-lose');
    for (let guess = 0; guess < 6; guess += 1) {
      await play(page, otherThan(answer, terms5, guess));
    }
    const result = page.locator('.tw-result');
    await expect(result).toContainText('Out of tries');
    await expect(result).toContainText(answer.term);
    await expect(page.getByRole('status')).toContainText(`The term was ${answer.term}`);
  });

  test('offers 3, 4 and 5 letters', async ({ page }) => {
    await openRound(page, 'seed=e2e-length');
    for (const [label, length] of [
      ['3 letters', 3],
      ['4 letters', 4],
      ['5 letters', 5],
    ] as const) {
      await page.getByRole('radio', { name: label }).check();
      await expect(rows(page).first().getByRole('gridcell')).toHaveCount(length);
    }
  });

  test('keeps to the chosen category and length from the address', async ({ page }) => {
    const answer = answerFor('e2e-category', terms4, 'security');
    expect(answer.category).toBe('security');
    await openRound(page, 'seed=e2e-category&length=4&category=security');
    await expect(rows(page).first().getByRole('gridcell')).toHaveCount(4);
    await play(page, answer.term);
    await expect(page.locator('.tw-result')).toContainText(techCategoryLabels.security);
  });

  test('starts a new round with the Enter key after the end, and with the button', async ({
    page,
  }) => {
    const answer = answerFor('e2e-next', terms3);
    await openRound(page, 'seed=e2e-next&length=3');
    await play(page, answer.term);
    await expect(page.locator('.tw-result')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('.tw-result')).toHaveCount(0);
    await expect(rows(page).first().getByRole('gridcell').first()).toHaveAttribute(
      'data-state',
      'empty',
    );

    // After the button was used, Enter must not press it again but hand in the guess
    await page.getByRole('button', { name: 'New round' }).first().click();
    await page.keyboard.type('ab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText('Not enough letters');
  });

  test('does not move anything while messages and the result come and go', async ({ page }) => {
    // The biggest result there can be: the term with the longest definition of the longest list
    const longest = terms5.reduce((best, term) =>
      term.definition.length > best.definition.length ? term : best,
    );
    let seed = 0;
    while (selectTerm(terms5, 'all', createRandom(seed)).term !== longest.term) {
      seed += 1;
    }
    await openRound(page, `seed=${String(seed)}`);

    // Where things are on the page, from the top of the document (scrolling does not matter)
    const top = (locator: Locator): Promise<number> =>
      locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    const board = page.getByRole('grid', { name: 'Your guesses' });
    const panel = page.getByText('How to play', { exact: true });
    const start = { board: await top(board), panel: await top(panel) };
    const moved = async (): Promise<number> =>
      Math.max(
        Math.abs((await top(board)) - start.board),
        Math.abs((await top(panel)) - start.panel),
      );

    // A message above the board
    await play(page, 'zzzzz');
    await expect(page.locator('.tw-toast span')).toBeVisible();
    expect(await moved(), 'with a message').toBeLessThanOrEqual(1);

    // The result takes the place of the keyboard
    for (let index = 0; index < 5; index += 1) {
      await page.keyboard.press('Backspace');
    }
    await play(page, longest.term);
    await expect(page.locator('.tw-result')).toContainText(longest.definition);
    expect(await moved(), 'with the result').toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Copy result' }).click();
    await expect(page.locator('.tw-toast span')).toBeVisible();
    expect(await moved(), 'with the result and a message').toBeLessThanOrEqual(1);

    // And back to the keyboard
    await page.getByRole('button', { name: 'New round' }).last().click();
    await expect(page.locator('.tw-result')).toHaveCount(0);
    expect(await moved(), 'with the keyboard again').toBeLessThanOrEqual(1);
  });

  test('puts a link into the copied result that opens the same puzzle', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const answer = answerFor('e2e-share', terms4, 'networking');
    await openRound(page, 'seed=e2e-share&length=4&category=networking');
    await play(page, answer.term);
    await page.getByRole('button', { name: 'Copy result' }).click();
    await expect(page.locator('.tw-toast span')).toHaveText('Result copied');

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('Tech Words, 4 letters, 1/6');
    const link = copied.split('\n').find((line) => line.startsWith('http'));
    expect(link).toBeDefined();

    // The link prepares the same round: the same length, and the same term as the answer
    const query = new URL(link ?? '').search;
    await page.goto(`${PATH}${query}`);
    await expect(rows(page).first().getByRole('gridcell')).toHaveCount(4);
    await play(page, answer.term);
    await expect(page.locator('.tw-result')).toContainText('Solved in 1 of 6 try');
  });

  test('works with the on-screen keyboard', async ({ page }) => {
    const answer = answerFor('e2e-screen', terms3);
    await openRound(page, 'seed=e2e-screen&length=3');
    for (const letter of answer.term) {
      await page.getByRole('button', { name: new RegExp(`^${letter}(,|$)`) }).click();
    }
    await page.getByRole('button', { name: 'Enter' }).click();
    await expect(page.locator('.tw-result')).toContainText(answer.term);
    await expect(page.getByRole('button', { name: 'Copy result' })).toBeVisible();
  });

  test('has no accessibility violations while playing and at the end', async ({ page }) => {
    const answer = answerFor('e2e-axe', terms5);
    await openRound(page, 'seed=e2e-axe');
    await play(page, otherThan(answer, terms5));
    await page.keyboard.type('abc');

    const scan = async (): Promise<string[]> => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      return results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.help}\n` +
          violation.nodes.map((node) => `  ${node.target.join(' ')}`).join('\n'),
      );
    };

    // Colors are measured without motion, so the scan waits for the flip to be over
    await page.waitForTimeout(2000);
    expect(await scan(), 'while playing').toEqual([]);

    for (let index = 0; index < 3; index += 1) {
      await page.keyboard.press('Backspace');
    }
    await play(page, answer.term);
    await expect(page.locator('.tw-result')).toBeVisible();
    await page.waitForTimeout(2500);
    expect(await scan(), 'at the end').toEqual([]);
  });

  test('stores nothing on the device during a round', async ({ page, context }) => {
    const answer = answerFor('e2e-storage', terms5);
    await openRound(page, 'seed=e2e-storage');
    await play(page, otherThan(answer, terms5));
    await play(page, answer.term);
    await expect(page.locator('.tw-result')).toBeVisible();

    const stored = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
    }));
    expect(stored).toEqual({ local: 0, session: 0, databases: 0, caches: 0 });
    expect(await context.cookies()).toEqual([]);
  });
});

test.describe('Tech Words with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the result of a guess at once, without waiting for a flip', async ({ page }) => {
    const answer = answerFor('e2e-calm', terms5);
    const wrong = otherThan(answer, terms5, 7);
    await openRound(page, 'seed=e2e-calm');
    await play(page, wrong);

    const last = rows(page).first().getByRole('gridcell').last();
    const [delay, transitionDelay] = await last.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.animationDelay, style.transitionDelay];
    });
    expect(delay).toBe('0s');
    expect(transitionDelay).toBe('0s');
    await expect(last).toHaveAttribute('data-state', /correct|present|absent/);
  });
});
