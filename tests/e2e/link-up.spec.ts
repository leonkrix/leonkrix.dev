import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';

import { categories, conflicts } from '../../src/games/link-up/data';
import { generatePuzzle } from '../../src/games/link-up/logic/puzzle';
import { createRandom } from '../../src/games/shared/random';
import { expect, test } from './fixtures';

const PATH = '/games/link-up/';
const SEED = 20261012;

/** The puzzle of a seed, made with the same code as the game. */
const puzzle = generatePuzzle(categories, conflicts, createRandom(SEED));

/** The names of the four terms of a group */
function termsOf(group: number): string[] {
  return puzzle.tiles.filter((tile) => tile.group === group).map((tile) => tile.name);
}

async function open(page: Page, query = `seed=${String(SEED)}`): Promise<void> {
  await page.goto(`${PATH}?${query}`);
  await expect(page.getByRole('group', { name: /Terms, pick four/ })).toBeVisible();
  // The tiles come in one after the other, and the board is ready when that is over
  await expect(page.locator('.lu[data-fresh]')).toHaveCount(0, { timeout: 5000 });
}

/** Waits until nothing moves any more (a check of the colors must not run in the middle of a fade) */
async function settled(page: Page): Promise<void> {
  // Only the game counts: the background of the site and the cursor of the wordmark never stop
  await page.waitForFunction(() =>
    (document.querySelector('.lu')?.getAnimations({ subtree: true }) ?? []).every(
      (animation) => animation.playState !== 'running',
    ),
  );
}

const tile = (page: Page, name: string): ReturnType<Page['getByRole']> =>
  page.getByRole('group', { name: /Terms, pick four/ }).getByRole('button', { name, exact: true });

/** Picks the given terms, one click each */
async function pick(page: Page, names: readonly string[]): Promise<void> {
  for (const name of names) {
    await tile(page, name).click();
  }
}

/** Four terms that do not belong together, and are not three of a kind either */
function twoAndTwo(first: number, second: number): string[] {
  return [...termsOf(first).slice(0, 2), ...termsOf(second).slice(0, 2)];
}

const mistakes = (page: Page): ReturnType<Page['getByRole']> =>
  page.getByRole('img', { name: /mistakes? left/ });

/**
 * Watches the layout on every frame, so that a jump of a single frame is found too: where the
 * main parts of the game are on the page (not on the screen, which scrolls while clicking), how big
 * they are and how big the page is.
 */
async function startTracking(page: Page): Promise<void> {
  await page.evaluate(() => {
    const boxes: Record<string, string> = {
      bar: '.lu-bar',
      toast: '.lu-toast',
      board: '.lu-board',
      info: '.lu-info',
      end: '.lu-end',
      footer: '.lu-footer',
    };
    // Buttons lift a little when pointed at: that is an effect, not a change of the layout, so
    // their place is taken from the layout (offsets) and not from the box they are drawn in
    const placed = (element: HTMLElement): { top: number; left: number } => {
      let top = 0;
      let left = 0;
      for (
        let node: HTMLElement | null = element;
        node !== null;
        node = node.offsetParent as HTMLElement | null
      ) {
        top += node.offsetTop;
        left += node.offsetLeft;
      }
      return { top, left };
    };
    const seen: Record<string, [number, number]> = {};
    const note = (key: string, value: number): void => {
      const range = seen[key];
      if (range === undefined) {
        seen[key] = [value, value];
      } else {
        range[0] = Math.min(range[0], value);
        range[1] = Math.max(range[1], value);
      }
    };
    const tracker = { seen, stop: false };
    (window as unknown as { __layout: typeof tracker }).__layout = tracker;
    const sample = (): void => {
      for (const [key, selector] of Object.entries(boxes)) {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        if (box !== undefined) {
          note(`${key} top`, box.top + window.scrollY);
          note(`${key} left`, box.left + window.scrollX);
          note(`${key} height`, box.height);
          note(`${key} width`, box.width);
        }
      }
      document.querySelectorAll<HTMLElement>('.lu-footer button').forEach((button, index) => {
        const place = placed(button);
        note(`footer button ${String(index)} top`, place.top);
        note(`footer button ${String(index)} left`, place.left);
      });
      note('page height', document.documentElement.scrollHeight);
      note('page width', document.documentElement.scrollWidth);
      if (!tracker.stop) {
        window.requestAnimationFrame(sample);
      }
    };
    sample();
  });
}

/** Fails if anything that was watched has moved or changed its size by more than half a pixel. */
async function expectNothingMoved(page: Page): Promise<void> {
  const seen = await page.evaluate(() => {
    const tracker = (
      window as unknown as { __layout: { seen: Record<string, [number, number]>; stop: boolean } }
    ).__layout;
    tracker.stop = true;
    return tracker.seen;
  });
  const moved = Object.entries(seen)
    .filter(([, [low, high]]) => high - low > 0.5)
    .map(([key, [low, high]]) => `${key}: ${String(low)} to ${String(high)}`);
  expect(moved).toEqual([]);
  expect(Object.keys(seen).length).toBeGreaterThan(20);
}

test.describe('Link Up', () => {
  test('shows sixteen terms, four tries and what to do', async ({ page }) => {
    await open(page);
    await expect(
      page.getByRole('group', { name: /Terms, pick four/ }).getByRole('button'),
    ).toHaveCount(16);
    await expect(mistakes(page)).toHaveAccessibleName('4 mistakes left');
    await expect(page.getByText('Point at a term or focus it')).toBeVisible();
  });

  test('says what a term means when it is pointed at or focused', async ({ page }) => {
    await open(page);
    const [first] = puzzle.tiles;
    if (first === undefined) {
      throw new Error('no tiles');
    }
    await tile(page, first.name).hover();
    await expect(page.locator('#lu-info')).toContainText(first.definition);
    const second = puzzle.tiles[5];
    if (second === undefined) {
      throw new Error('no tiles');
    }
    await tile(page, second.name).focus();
    await expect(page.locator('#lu-info')).toContainText(second.definition);
  });

  test('picks and puts back tiles, and never more than four', async ({ page }) => {
    await open(page);
    const names = puzzle.tiles.map((entry) => entry.name);
    await pick(page, names.slice(0, 4));
    // The fourth one hands the group in by itself, so check the third pick and the put-back first
    await open(page);
    await pick(page, names.slice(0, 3));
    await expect(tile(page, names[0] ?? '')).toHaveAttribute('aria-pressed', 'true');
    await tile(page, names[0] ?? '').click();
    await expect(tile(page, names[0] ?? '')).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Deselect all' }).click();
    await expect(page.locator('.lu-tile[aria-pressed="true"]')).toHaveCount(0);
  });

  test('shows a correct group with its name, and keeps the other tiles', async ({ page }) => {
    await open(page);
    await pick(page, termsOf(1));
    const group = puzzle.groups[1];
    await expect(page.getByRole('region', { name: group?.name ?? '' })).toBeVisible();
    await expect(
      page.getByRole('group', { name: /Terms, pick four/ }).getByRole('button'),
    ).toHaveCount(12);
    await expect(mistakes(page)).toHaveAccessibleName('4 mistakes left');
    // The description of the group is not needed, but its terms can be asked what they mean
    const [first] = termsOf(1);
    await page
      .getByRole('region', { name: group?.name ?? '' })
      .getByRole('button', { name: first ?? '' })
      .hover();
    await expect(page.locator('#lu-info')).toContainText(group?.terms[0]?.definition ?? '');
  });

  test('shakes and takes a try for a wrong group, and does not charge the same one twice', async ({
    page,
  }) => {
    await open(page);
    const wrong = twoAndTwo(0, 1);
    await pick(page, wrong);
    await expect(mistakes(page)).toHaveAccessibleName('3 mistakes left');
    await expect(page.locator('.lu-tile[aria-pressed="true"]')).toHaveCount(0);
    await pick(page, wrong);
    await expect(page.getByText('You tried that already')).toBeVisible();
    await expect(mistakes(page)).toHaveAccessibleName('3 mistakes left');
  });

  test('says "One away" when three of the four belong together', async ({ page }) => {
    await open(page);
    await pick(page, [...termsOf(0).slice(0, 3), ...termsOf(1).slice(0, 1)]);
    await expect(page.getByText('One away!')).toBeVisible();
    await expect(mistakes(page)).toHaveAccessibleName('3 mistakes left');
  });

  test('is won with four groups, and a new puzzle can be started', async ({ page }) => {
    await open(page);
    for (const group of [2, 0, 3, 1]) {
      await pick(page, termsOf(group));
      await expect(
        page.getByRole('region', { name: puzzle.groups[group]?.name ?? '' }),
      ).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    await expect(page.getByText('without a single mistake')).toBeVisible();
    await page.getByRole('button', { name: 'New puzzle' }).first().click();
    await expect(
      page.getByRole('group', { name: /Terms, pick four/ }).getByRole('button'),
    ).toHaveCount(16);
    await expect(page.getByRole('heading', { name: 'Solved!' })).toHaveCount(0);
  });

  test('moves nothing on the page at any moment of a won game', async ({ page }) => {
    await open(page);
    await startTracking(page);
    // Pointing at terms (definitions of different lengths), a wrong group, one away, the eye
    await tile(page, termsOf(0)[0] ?? '').hover();
    await page.getByRole('button', { name: 'Show definitions' }).click();
    await tile(page, termsOf(1)[0] ?? '').hover();
    await page.getByRole('button', { name: 'Show definitions' }).click();
    await pick(page, twoAndTwo(0, 1));
    await expect(mistakes(page)).toHaveAccessibleName('3 mistakes left');
    await pick(page, [...termsOf(0).slice(0, 3), ...termsOf(1).slice(0, 1)]);
    await expect(page.getByText('One away!')).toBeVisible();
    for (const group of [2, 0, 3, 1]) {
      await pick(page, termsOf(group));
      await expect(
        page.getByRole('region', { name: puzzle.groups[group]?.name ?? '' }),
      ).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    await settled(page);
    await expectNothingMoved(page);
  });

  test('moves nothing on the page at any moment of a lost game', async ({ page }) => {
    await open(page);
    await startTracking(page);
    await pick(page, termsOf(1));
    await expect(page.getByRole('region', { name: puzzle.groups[1]?.name ?? '' })).toBeVisible();
    const [a, b, c] = [termsOf(0), termsOf(2), termsOf(3)];
    const wrongs = [
      [...a.slice(0, 2), ...b.slice(0, 2)],
      [...a.slice(0, 2), ...c.slice(0, 2)],
      [...b.slice(0, 2), ...c.slice(0, 2)],
      [...a.slice(2, 4), ...b.slice(2, 4)],
    ];
    for (const [index, names] of wrongs.entries()) {
      await pick(page, names);
      if (index < 3) {
        await expect(mistakes(page)).toHaveAccessibleName(`${String(3 - index)} mistakes left`);
      }
    }
    await expect(page.getByRole('heading', { name: 'Out of tries' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('region', { name: /not found/ })).toHaveCount(3);
    await settled(page);
    await expectNothingMoved(page);
  });

  test('moves nothing on the narrowest phones either', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    await startTracking(page);
    await tile(page, termsOf(2)[1] ?? '').hover();
    await pick(page, twoAndTwo(0, 3));
    await expect(mistakes(page)).toHaveAccessibleName('3 mistakes left');
    for (const group of [3, 0, 2, 1]) {
      await pick(page, termsOf(group));
      await expect(
        page.getByRole('region', { name: puzzle.groups[group]?.name ?? '' }),
      ).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    await settled(page);
    await expectNothingMoved(page);
  });

  test('blurs the definitions with the eye, and shows them again', async ({ page }) => {
    await open(page);
    const eye = page.getByRole('button', { name: 'Show definitions' });
    const definition = page.locator('.lu-definition');
    const [first] = puzzle.tiles;
    if (first === undefined) {
      throw new Error('no tiles');
    }
    await expect(eye).toHaveAttribute('aria-pressed', 'true');
    await tile(page, first.name).hover();
    await expect(definition).toHaveText(first.definition);
    await expect(definition).not.toHaveAttribute('data-blurred', /.*/);
    expect(await definition.evaluate((element) => getComputedStyle(element).filter)).toBe('none');

    await eye.click();
    await expect(eye).toHaveAttribute('aria-pressed', 'false');
    await expect(definition).toHaveAttribute('data-blurred', 'true');
    await expect(definition).toHaveAttribute('aria-hidden', 'true');
    await expect
      .poll(() => definition.evaluate((element) => getComputedStyle(element).filter))
      .toContain('blur');
    // The name of the term stays readable, and the choice survives a new puzzle
    await expect(page.locator('#lu-info strong')).toHaveText(first.name);
    await page.getByRole('button', { name: 'New puzzle' }).first().click();
    await expect(eye).toHaveAttribute('aria-pressed', 'false');

    await eye.click();
    await expect(eye).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.lu-tile').first().hover();
    await expect(page.locator('.lu-definition')).not.toHaveAttribute('data-blurred', /.*/);
  });

  test('is lost with the fourth mistake, and shows the missing groups', async ({ page }) => {
    await open(page);
    await pick(page, termsOf(1));
    await expect(page.getByRole('region', { name: puzzle.groups[1]?.name ?? '' })).toBeVisible();
    // Four different wrong groups made of the other three groups
    const [a, b, c] = [termsOf(0), termsOf(2), termsOf(3)];
    const wrongs = [
      [...a.slice(0, 2), ...b.slice(0, 2)],
      [...a.slice(0, 2), ...c.slice(0, 2)],
      [...b.slice(0, 2), ...c.slice(0, 2)],
      [...a.slice(2, 4), ...b.slice(2, 4)],
    ];
    for (const [index, names] of wrongs.entries()) {
      await pick(page, names);
      if (index < 3) {
        await expect(mistakes(page)).toHaveAccessibleName(`${String(3 - index)} mistakes left`);
      }
    }
    await expect(page.getByRole('heading', { name: 'Out of tries' })).toBeVisible({
      timeout: 15_000,
    });
    for (const group of [0, 2, 3]) {
      await expect(
        page.getByRole('region', { name: `${puzzle.groups[group]?.name ?? ''} (not found)` }),
      ).toBeVisible();
    }
  });

  test('can be played with the keyboard', async ({ page }) => {
    await open(page);
    // The tile that Tab reaches (the others are reached with the arrow keys)
    await page.locator('.lu-tile[tabindex="0"]').focus();
    const first = await page.evaluate(() => document.activeElement?.textContent ?? '');
    await page.keyboard.press('Space');
    await expect(tile(page, first)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('.lu-tile[aria-pressed="true"]')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(page.locator('.lu-tile[aria-pressed="true"]')).toHaveCount(0);
  });

  test('makes the same puzzle again from its link, and another one without', async ({ page }) => {
    await open(page);
    const first = await page.locator('.lu-tile').allInnerTexts();
    await open(page);
    expect(await page.locator('.lu-tile').allInnerTexts()).toEqual(first);
    await page.goto(PATH);
    await expect(page.locator('.lu-tile')).toHaveCount(16);
    expect(await page.locator('.lu-tile').allInnerTexts()).not.toEqual(first);
  });

  test('stores nothing on the device after a round', async ({ page }) => {
    await open(page);
    for (const group of [0, 1, 2, 3]) {
      await pick(page, termsOf(group));
      await expect(
        page.getByRole('region', { name: puzzle.groups[group]?.name ?? '' }),
      ).toBeVisible();
    }
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
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await pick(page, termsOf(0));
    await expect(page.getByRole('region', { name: puzzle.groups[0]?.name ?? '' })).toBeVisible();
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    for (const group of [1, 2, 3]) {
      await pick(page, termsOf(group));
      await expect(
        page.getByRole('region', { name: puzzle.groups[group]?.name ?? '' }),
      ).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('has no horizontal scrolling on a small screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});

test.describe('Link Up with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('plays without any animation', async ({ page }) => {
    await open(page);
    expect(
      await page
        .locator('.lu')
        .evaluate((element) => element.getAnimations({ subtree: true }).length),
    ).toBe(0);
    await pick(page, twoAndTwo(0, 1));
    await expect(mistakes(page)).toHaveAccessibleName('3 mistakes left');
    expect(
      await page
        .locator('.lu')
        .evaluate((element) => element.getAnimations({ subtree: true }).length),
    ).toBe(0);
  });
});
