import { readFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { type Locator, type Page } from '@playwright/test';

import { STORIES } from '../../src/games/root-cause/data/stories';
import { Board } from '../../src/games/root-cause/logic/board';
import { check, subjectOf, UNPLACED } from '../../src/games/root-cause/logic/clues';
import { type LevelRecord, toLevel } from '../../src/games/root-cause/pool';
import { expect, gameReady, test } from './fixtures';

const PATH = '/games/root-cause/';

const levels = JSON.parse(
  readFileSync('src/games/root-cause/data/levels.json', 'utf8'),
) as LevelRecord[];

function levelOf(id: string): LevelRecord {
  const found = levels.find((level) => level.id === id);
  if (found === undefined) {
    throw new Error(`no level ${id}`);
  }
  return found;
}

/** The cells that nobody can stand on because an object blocks them */
function blockedCells(level: LevelRecord): ReadonlySet<number> {
  const { layout, kinds } = toLevel(level);
  return new Board(layout, kinds).blocked;
}

const cellOf = (page: Page, cell: number) => page.locator(`[data-cell="${String(cell)}"]`);

/** Moves the cursor to a cell with the arrow keys, from wherever the focus is. */
async function moveTo(page: Page, cell: number, size: number): Promise<void> {
  const current = Number(
    await page.evaluate(() => document.activeElement?.getAttribute('data-cell') ?? '-1'),
  );
  if (current < 0) {
    await cellOf(page, cell).focus();
    return;
  }
  const rowDelta = Math.floor(cell / size) - Math.floor(current / size);
  const colDelta = (cell % size) - (current % size);
  for (let step = 0; step < Math.abs(rowDelta); step += 1) {
    await page.keyboard.press(rowDelta < 0 ? 'ArrowUp' : 'ArrowDown');
  }
  for (let step = 0; step < Math.abs(colDelta); step += 1) {
    await page.keyboard.press(colDelta < 0 ? 'ArrowLeft' : 'ArrowRight');
  }
}

/** Solves a level with the keyboard only: choose a person with a digit, go to the cell, Enter. */
async function solveWithKeyboard(page: Page, level: LevelRecord): Promise<void> {
  const first = level.solution[0] ?? 0;
  await cellOf(page, first).focus();
  for (const [person, cell] of level.solution.entries()) {
    await page.keyboard.press(String(person + 1));
    await moveTo(page, cell, level.size);
    await page.keyboard.press('Enter');
    await expect(cellOf(page, cell).locator('.rc-token')).toBeVisible();
  }
}

/**
 * Opens a level the way a player does: from the choice page. (A level that is opened straight from
 * its address starts at another height than the choice page that the page shows while the game
 * loads, which the layout guard would rightly report.)
 */
async function open(page: Page, id: string): Promise<void> {
  const title = STORIES[id]?.title ?? id;
  await page.goto(PATH);
  await gameReady(page);
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByRole('grid')).toBeVisible();
}

test.describe('Root Cause', () => {
  test('shows the choice of a level, and a level opens with its address', async ({ page }) => {
    await page.goto(PATH);
    await gameReady(page);
    await expect(page.getByRole('heading', { name: 'Choose a level' })).toBeVisible();
    // 18 levels in three groups, and the random level
    await expect(page.locator('.rc-card')).toHaveCount(18);
    await page.getByRole('button', { name: /The late shift/ }).click();
    await expect(page.getByRole('heading', { name: 'The late shift' })).toBeFocused();
    await expect(page).toHaveURL(/\?level=easy-1$/);
    await expect(page.getByRole('grid')).toBeVisible();

    await page.getByRole('button', { name: 'Level selection' }).click();
    await expect(page.getByRole('heading', { name: 'Choose a level' })).toBeFocused();
    await expect(page.locator('.rc-card')).toHaveCount(18);
  });

  test('solves a level with the keyboard and shows the culprit', async ({ page }) => {
    const level = levelOf('easy-1');
    await open(page, 'easy-1');
    await solveWithKeyboard(page, level);

    const result = page.locator('.rc-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Case closed');
    await expect(page.locator('.rc-token[data-culprit]')).toHaveCount(1);
    // Every clue is ticked
    await expect(page.locator('.rc-clues [data-done]')).toHaveCount(level.clues.length);
    // The result takes the place of a box of the same height: nothing below moves
    await expect(page.getByRole('button', { name: 'Next level' })).toBeVisible();
  });

  test('crosses out the row and column of a person, and refuses to place anybody there', async ({
    page,
  }) => {
    const level = levelOf('easy-1');
    const { size } = level;
    const blocked = blockedCells(level);
    await open(page, 'easy-1');
    const home = level.solution[0] ?? 0;
    await page.keyboard.press('1');
    await cellOf(page, home).click();

    // A free cell in the row of the first person
    const target = Array.from(
      { length: size },
      (_, col) => Math.floor(home / size) * size + col,
    ).find((cell) => cell !== home && !blocked.has(cell));
    expect(target, 'a free cell in the row').toBeDefined();
    await expect(cellOf(page, target ?? 0)).toHaveAttribute('data-crossed', 'true');

    // Somebody else cannot be placed on that cross: the cell shakes and says why
    await page.keyboard.press('2');
    await cellOf(page, target ?? 0).click();
    await expect(cellOf(page, target ?? 0).locator('.rc-token')).toHaveCount(0);
    await expect(cellOf(page, target ?? 0)).toHaveAttribute('data-refused', 'true');
    await expect(page.getByRole('status')).toContainText('crossed out');

    // Taking the first person off (the same person, the same cell) gives the cells back
    await page.keyboard.press('1');
    await cellOf(page, home).click();
    await expect(cellOf(page, target ?? 0)).not.toHaveAttribute('data-crossed', 'true');
  });

  test('ticks a clue that is satisfied and turns a broken one red', async ({ page }) => {
    const record = levelOf('easy-1');
    await open(page, 'easy-1');
    // A cell where the first suspect breaks one of the clues about them (the same check as the game)
    const { layout, kinds, people, clues, solution } = toLevel(record);
    const board = new Board(layout, kinds);
    const context = { board, people, victim: people.length - 1 };
    const aboutFirst = clues.filter((clue) => subjectOf(clue) === 0);
    const rightCell = solution[0] ?? 0;
    const wrongCell = Array.from({ length: board.cellCount }, (_, cell) => cell).find(
      (cell) =>
        !board.blocked.has(cell) &&
        aboutFirst.some(
          (clue) =>
            check(
              clue,
              context,
              people.map((_, person) => (person === 0 ? cell : UNPLACED)),
            ) === false,
        ),
    );
    expect(wrongCell, 'a cell that breaks a clue about the first suspect').toBeDefined();
    await page.keyboard.press('1');
    await cellOf(page, wrongCell ?? 0).click();
    await expect(page.locator('.rc-clues [data-wrong]').first()).toBeVisible();

    // Moving the person to the right cell takes the red away
    await cellOf(page, wrongCell ?? 0).click();
    await cellOf(page, rightCell).click();
    await expect(page.locator('.rc-clues [data-wrong]')).toHaveCount(0);
    await expect(page.locator('.rc-clues [data-done]').first()).toBeVisible();
  });

  test('explains the pictures in a dialog that moves nothing', async ({ page }) => {
    await open(page, 'easy-1');
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.getByRole('button', { name: 'Legend' }).click();
    const dialog = page.getByRole('dialog', { name: 'What the pictures mean' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      'Window: a bright bar on a wall. It belongs to the cells on both sides of it',
    );
    await expect(dialog).toContainText('Cross:');
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(before);

    // Keys typed in the dialog are not moves on the map
    await page.keyboard.press('1');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('gives a hint in three stages, counts them, and takes them back when the map changes', async ({
    page,
  }) => {
    const level = levelOf('easy-1');
    await open(page, 'easy-1');
    const hintButton = page.getByRole('button', { name: /^Hint/ });
    // Asking for hints moves nothing: the tools keep their places while the counter appears
    const legend = page.getByRole('button', { name: 'Legend' });
    const placeOf = (target: Locator): Promise<number[]> =>
      target.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return [box.x, box.y + window.scrollY, box.width, box.height];
      });
    const tools = page.locator('.rc-tools').first();
    const legendBefore = await placeOf(legend);
    const toolsBefore = await placeOf(tools);
    await hintButton.click();
    await expect(page.locator('.rc-hint-step')).toHaveText('Hint 1 of 3');
    expect(await placeOf(legend)).toEqual(legendBefore);
    expect(await placeOf(tools)).toEqual(toolsBefore);
    // The first stage points at a person in the list, no clue and no cell is marked yet
    await expect(page.locator('.rc-person[data-hint]')).toHaveCount(1);
    await expect(page.locator('.rc-clues [data-hint]')).toHaveCount(0);
    await expect(page.locator('.rc-cell[data-hint]')).toHaveCount(0);

    await hintButton.click();
    await expect(page.locator('.rc-hint-step')).toHaveText('Hint 2 of 3');
    expect(await page.locator('.rc-clues [data-hint]').count()).toBeGreaterThan(0);

    await hintButton.click();
    await expect(page.locator('.rc-hint-step')).toHaveText('Hint 3 of 3');
    const marked = page.locator('.rc-cell[data-hint]');
    expect(await marked.count()).toBeGreaterThan(0);
    // The person belongs on one of the marked cells (the hint never points at a wrong cell)
    const person = await page
      .locator('.rc-person[data-hint]')
      .evaluate((element) =>
        Array.from(element.parentElement?.parentElement?.children ?? []).indexOf(
          element.parentElement as Element,
        ),
      );
    const solutionCell = level.solution[person] ?? -1;
    await expect(cellOf(page, solutionCell)).toHaveAttribute('data-hint', 'true');
    // Three hints were used
    await expect(hintButton).toHaveAccessibleName('Hint, 3 used');

    // The last stage explains why, in a dialog that moves nothing on the page
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.getByRole('button', { name: 'Why here?' }).click();
    const why = page.getByRole('dialog', { name: 'Why here?' });
    await expect(why).toBeVisible();
    expect(await why.getByRole('listitem').count()).toBeGreaterThanOrEqual(2);
    await expect(why.getByRole('listitem').last()).toContainText('So ');
    await page.keyboard.press('Escape');
    await expect(why).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(before);

    // A hint is gone when the people on the map change
    await page.keyboard.press(String(person + 1));
    await cellOf(page, solutionCell).click();
    await expect(page.locator('.rc-cell[data-hint]')).toHaveCount(0);
    await expect(page.locator('.rc-hint-step')).toHaveCount(0);
  });

  test('shows a pencil after the name of a person who has notes', async ({ page }) => {
    const level = levelOf('easy-1');
    const blocked = blockedCells(level);
    await open(page, 'easy-1');
    const free = Array.from({ length: level.size * level.size }, (_, cell) => cell).find(
      (cell) => !blocked.has(cell),
    );
    await page.getByRole('button', { name: 'Note' }).click();
    await page.keyboard.press('2');
    await expect(page.locator('.rc-person[data-noted]')).toHaveCount(0);
    await cellOf(page, free ?? 0).click();
    await expect(page.locator('.rc-person[data-noted]')).toHaveCount(1);
  });

  test('names who stands on a cell in the line under the map', async ({ page }) => {
    const level = levelOf('easy-1');
    await open(page, 'easy-1');
    const home = level.solution[0] ?? 0;
    await page.keyboard.press('1');
    await cellOf(page, home).click();
    await cellOf(page, home).hover();
    const name = toLevel(level).people[0]?.name ?? '';
    await expect(page.locator('.rc-cellinfo')).toContainText(name);
  });

  test('makes a random level in the browser with the workers, and opens it from its link', async ({
    page,
  }) => {
    await page.goto(PATH);
    await gameReady(page);
    await page.getByLabel('Difficulty').selectOption('easy');
    await page.getByLabel('Size').selectOption('4');
    await page.getByRole('button', { name: 'New level' }).click();
    await expect(page.getByRole('button', { name: 'Level selection' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator('.rc-eyebrow')).toContainText('4×4');
    const link = page.url();
    expect(link).toContain('level=random&seed=');
    const title = await page.getByRole('heading', { level: 2 }).innerText();

    // The link makes the very same level again
    await page.goto(link);
    await expect(page.getByRole('button', { name: 'Level selection' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(title);
  });

  test('makes a random level in the look that was asked for', async ({ page }) => {
    await page.goto(PATH);
    // The page shows the skeleton of the game first: the choices must be made in the game, otherwise
    // the game takes over a moment later and starts again with its own defaults
    await gameReady(page);
    await page.getByLabel('Difficulty').selectOption('easy');
    await page.getByLabel('Size').selectOption('4');
    await page.getByLabel('Look of the level').selectOption('outage');
    await page.getByRole('button', { name: 'New level' }).click();
    await expect(page.getByRole('button', { name: 'Level selection' })).toBeVisible({
      timeout: 60_000,
    });
    // The address follows the level a moment later, so it is waited for
    await expect(page).toHaveURL(/skin=outage/);
    await expect(page.locator('.rc-eyebrow')).toContainText('Outage');
  });

  test('shows the role of every person on a small screen too', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page, 'easy-1');
    const roles = page.locator('.rc-person-role');
    expect(await roles.count()).toBeGreaterThan(0);
    for (const role of await roles.all()) {
      await expect(role).toBeVisible();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test('stores nothing on the device after a round', async ({ page }) => {
    await open(page, 'easy-2');
    await solveWithKeyboard(page, levelOf('easy-2'));
    await expect(page.locator('.rc-result')).toBeVisible();
    const stored = await page.evaluate(async () => ({
      localStorage: localStorage.length,
      sessionStorage: sessionStorage.length,
      indexedDB: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
    }));
    expect(stored).toEqual({ localStorage: 0, sessionStorage: 0, indexedDB: 0, caches: 0 });
  });

  test('has no accessibility violations on the choice page, a level and the legend', async ({
    page,
  }) => {
    await page.goto(PATH);
    await gameReady(page);
    await expect(page.locator('.rc-card')).toHaveCount(18);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await open(page, 'easy-1');
    await cellOf(page, levelOf('easy-1').solution[0] ?? 0).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByRole('button', { name: 'Legend' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});

test.describe('Root Cause with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('does not animate the people or a refused click', async ({ page }) => {
    await open(page, 'easy-1');
    const level = levelOf('easy-1');
    await cellOf(page, level.solution[0] ?? 0).click();
    const token = page.locator('.rc-token').first();
    await expect(token).toBeVisible();
    expect(await token.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  });
});
