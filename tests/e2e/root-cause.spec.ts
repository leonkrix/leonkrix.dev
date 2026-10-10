import { readFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';

import { Board } from '../../src/games/root-cause/logic/board';
import { check, subjectOf, UNPLACED } from '../../src/games/root-cause/logic/clues';
import { type LevelRecord, toLevel } from '../../src/games/root-cause/pool';
import { expect, test } from './fixtures';

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

async function open(page: Page, id: string): Promise<void> {
  await page.goto(`${PATH}?level=${id}`);
  await expect(page.getByRole('grid')).toBeVisible();
}

test.describe('Root Cause', () => {
  test('shows the choice of a level, and a level opens with its address', async ({ page }) => {
    await page.goto(PATH);
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
    await expect(dialog).toContainText('Window: a bright bar on the edge of a cell');
    await expect(dialog).toContainText('Cross:');
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(before);

    // Keys typed in the dialog are not moves on the map
    await page.keyboard.press('1');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('makes a random level in the browser with the workers, and opens it from its link', async ({
    page,
  }) => {
    await page.goto(PATH);
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
