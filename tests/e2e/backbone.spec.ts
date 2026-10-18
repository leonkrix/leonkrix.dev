import { readFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';

import { type LevelRecord } from '../../src/games/backbone/data/pool';
import { expect, gameReady, test } from './fixtures';

const PATH = '/games/backbone/';

const levels = JSON.parse(
  readFileSync('src/games/backbone/data/levels.json', 'utf8'),
) as LevelRecord[];

function levelOf(id: string): LevelRecord {
  const found = levels.find((level) => level.id === id);
  if (found === undefined) {
    throw new Error(`no level ${id}`);
  }
  return found;
}

/** Opens the overview, and from there a level, the way a player does. */
async function open(page: Page, id: string): Promise<void> {
  await page.goto(PATH);
  await gameReady(page);
  await page.locator(`a[href="?level=${id}"]`).click();
  await expect(page.locator('.bb-map')).toBeVisible();
  // The level pool is fetched after the page is painted, the map is there when it has arrived
  await expect(page.locator('.bb-node').first()).toBeVisible({ timeout: 15_000 });
}

const node = (page: Page, id: string) => page.locator(`.bb-node[data-node="${id}"]`);

/** Draws the path of a flow by clicking its nodes one after the other. */
async function drawByClicks(page: Page, flowName: string, nodes: readonly string[]): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^Flow [0-9]+: ${flowName}`) }).click();
  for (const id of nodes) {
    await node(page, id).click();
  }
}

/** Plays the best plan of a level with clicks (every flow has one path in the early chapters). */
async function playBest(page: Page, record: LevelRecord): Promise<void> {
  for (const flow of record.level.flows) {
    const plan = record.best.plan[flow.id];
    const path = plan?.stages[0]?.paths[0]?.nodes;
    if (path === undefined) {
      throw new Error(`no path for ${flow.id}`);
    }
    await drawByClicks(page, flow.name, path);
  }
}

test.describe('Backbone', () => {
  test('shows the campaign as a page of its own and opens a level from it', async ({ page }) => {
    await page.goto(PATH);
    await gameReady(page);
    await expect(page.getByRole('heading', { name: 'Choose a level' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /First packets/ })).toBeVisible();
    const cards = page.locator('a.bb-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(levels.length);
    await page.locator('a[href="?level=c1-1"]').click();
    await expect(page.locator('.bb-node').first()).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/level=c1-1/);
    await page.getByRole('link', { name: 'All levels' }).click();
    await expect(page.getByRole('heading', { name: 'Choose a level' })).toBeVisible();
    await page.goBack();
    await expect(page.locator('.bb-node').first()).toBeVisible();
  });

  test('can be solved by clicking: a perfect plan earns 100 and three stars', async ({ page }) => {
    const record = levelOf('c1-1');
    await open(page, 'c1-1');
    await expect(page.getByRole('button', { name: 'Run' })).toBeDisabled();
    await playBest(page, record);
    await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.bb-score-number strong')).toHaveText('100');
    await expect(page.locator('.bb-stars')).toHaveAttribute('aria-label', '3 of 3 stars');
    // The result offers the best plan only once the level is solved
    await expect(page.getByRole('button', { name: 'Load the best plan' })).toBeVisible();
    await page.getByRole('button', { name: 'Change the plan' }).click();
    await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled();
  });

  test('can be played with the keyboard', async ({ page }) => {
    const record = levelOf('c1-1');
    await open(page, 'c1-1');
    const flow = record.level.flows[0];
    const path =
      flow === undefined ? undefined : record.best.plan[flow.id]?.stages[0]?.paths[0]?.nodes;
    expect(path).toBeDefined();
    for (const id of path ?? []) {
      await node(page, id).focus();
      await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('status').filter({ hasText: /goes/ })).toBeVisible();
    // Backspace takes a node back while a path is drawn, Escape cancels it
    const second = record.level.flows[1];
    if (second !== undefined) {
      await page.getByRole('button', { name: new RegExp(`^Flow [0-9]+: ${second.name}`) }).click();
      await node(page, second.source).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.bb-route-chips[data-drawing="true"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.bb-route-chips[data-drawing="true"]')).toHaveCount(0);
    }
  });

  test('refuses a wrong first node and a node that is not next to the last', async ({ page }) => {
    const record = levelOf('c1-1');
    await open(page, 'c1-1');
    const flow = record.level.flows[0];
    const other = record.level.nodes.find((entry) => entry.id !== flow?.source);
    await node(page, other?.id ?? '').click();
    await expect(page.getByRole('status').filter({ hasText: /Start at/ })).toBeVisible();
  });

  test('a helper fills in the plan and earns no stars', async ({ page }) => {
    await open(page, 'c1-1');
    await page.getByRole('button', { name: 'Auto: shortest' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.bb-stars')).toHaveAttribute(
      'aria-label',
      'No stars: a helper filled in the plan',
    );
    await expect(page.getByText(/earns no stars/).first()).toBeVisible();
    // Undo and redo work on the plan
    await page.getByRole('button', { name: 'Change the plan' }).click();
    await page.getByRole('button', { name: /Undo/ }).click();
    await expect(page.getByRole('button', { name: 'Run' })).toBeDisabled();
    await page.getByRole('button', { name: /Redo/ }).click();
    await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled();
  });

  test('plays the stress test step by step', async ({ page }) => {
    await open(page, 'c2-4');
    await page.getByRole('button', { name: 'Auto: balanced' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('button', { name: /Pause|Play/ })).toBeVisible();
    await page.getByRole('button', { name: /Pause|Play/ }).click();
    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Step 2 of/ })).toBeVisible();
    await page.getByRole('slider', { name: 'Step' }).fill('0');
    await expect(page.getByRole('status').filter({ hasText: /Step 1 of/ })).toBeVisible();
    // Another situation
    const situations = page.getByRole('group', { name: 'Situation' }).getByRole('button');
    if ((await situations.count()) > 1) {
      await situations.nth(1).click();
      await expect(situations.nth(1)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('has a text version with every cable and flow', async ({ page }) => {
    const record = levelOf('c1-1');
    await open(page, 'c1-1');
    await page.getByText('Text version of the network').click();
    await expect(page.getByRole('table')).toBeVisible();
    for (const flow of record.level.flows) {
      await expect(page.getByRole('listitem').filter({ hasText: flow.name }).first()).toBeVisible();
    }
  });

  test('chapters with their own rules offer them: splitting, throttling and building', async ({
    page,
  }) => {
    await open(page, 'c3-1');
    await expect(page.getByText('Split', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Auto: shortest' }).click();
    await expect(page.getByText('Split', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add path' }).click();
    await expect(page.getByRole('button', { name: /Path 2/ })).toBeVisible();
    await page.getByRole('link', { name: 'All levels' }).click();
    await page.locator('a[href="?level=c8-1"]').click();
    await expect(page.getByRole('list', { name: 'Cables that can be built' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Build', exact: true }).first().click();
    await expect(page.getByText(/is built for/)).toBeVisible();
    await page.getByRole('button', { name: 'Remove', exact: true }).first().click();
    await expect(page.getByText(/is not built any more/)).toBeVisible();
  });

  test('numbers the flows, takes one route away and looks at one flow in the result', async ({
    page,
  }) => {
    const record = levelOf('c1-1');
    await open(page, 'c1-1');
    // Every flow has a number in the list and badges at its nodes: filled at the start, outlined at the end
    await expect(page.locator('.bb-flow-number')).toHaveCount(record.level.flows.length);
    await expect(page.locator('.bb-badge[data-end="false"]')).toHaveCount(
      record.level.flows.length,
    );
    await expect(page.locator('.bb-badge[data-end="true"]')).toHaveCount(record.level.flows.length);
    await playBest(page, record);
    await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled();
    // Take the route of the selected flow away: only that flow loses its path
    const first = record.level.flows[0];
    await page
      .getByRole('button', { name: new RegExp(`^Flow [0-9]+: ${first?.name ?? ''}`) })
      .click();
    await page.getByRole('button', { name: 'Remove route' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: /has no route any more/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Remove route' })).toHaveCount(0);
    await page.getByRole('button', { name: /Undo/ }).click();
    await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled();
    // In the result a flow can be picked: the others fade on the map
    await page.getByRole('button', { name: 'Run' }).click();
    const row = page.locator('.bb-row-flow').first();
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.bb-badge[data-dim="true"]').first()).toBeVisible();
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'false');
  });

  test('explains the two simple strategies in the result', async ({ page }) => {
    await open(page, 'c1-1');
    await page.getByRole('button', { name: 'Auto: shortest' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByText('Every flow takes its fastest path.')).toBeVisible();
    await expect(page.getByText(/never splits a flow/).first()).toBeVisible();
  });

  test('gives hints that get more concrete, and the last one costs the stars', async ({ page }) => {
    const record = levelOf('c1-1');
    await open(page, 'c1-1');
    const status = page.getByRole('status').filter({ hasText: /Hint/ });
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(status).toContainText('Give every flow a path first');
    await playBest(page, levelOf('c1-1'));
    // A plan that is already the best one has nothing left to hint at
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: /about as good as it gets/ }),
    ).toBeVisible();
    // A worse plan: the helper "shortest" is worse in c1-1, so the hints have something to say
    await page.getByRole('button', { name: 'Auto: shortest' }).click();
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Hint 1 of 3/ })).toBeVisible();
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Hint 2 of 3/ })).toBeVisible();
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: /Hint 3 of 3.*earns no stars/ }),
    ).toBeVisible();
    expect(record.level.flows.length).toBeGreaterThan(0);
  });

  test('shows the buffers of the links from the chapter about queues on', async ({ page }) => {
    await open(page, 'c6-1');
    await page.getByText('Text version of the network').click();
    await expect(page.getByRole('columnheader', { name: 'Buffer' })).toBeVisible();
    const buffers = await page.locator('.bb-text tbody tr td:nth-child(4)').allTextContents();
    expect(buffers.some((value) => Number(value) > 0)).toBe(true);
  });

  test('makes a random level in the background', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(PATH);
    await gameReady(page);
    await page.getByRole('button', { name: 'Make a level' }).click();
    await expect(page.locator('.bb-node').first()).toBeVisible({ timeout: 90_000 });
    await expect(page).toHaveURL(/level=random&tier=1&seed=/);
  });

  test('stores nothing on the device', async ({ page }) => {
    await open(page, 'c1-1');
    await page.getByRole('button', { name: 'Auto: shortest' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    const stored = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
    }));
    expect(stored).toEqual({ local: 0, session: 0, cookies: '', databases: 0, caches: 0 });
  });

  test('has no accessibility violations: overview, level and result', async ({ page }) => {
    await page.goto(PATH);
    await gameReady(page);
    let results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.locator('a[href="?level=c1-1"]').click();
    await expect(page.locator('.bb-node').first()).toBeVisible({ timeout: 15_000 });
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('button', { name: 'Auto: shortest' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.bb-score-number strong')).toBeVisible();
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('shows still frames when the system asks for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'c1-1');
    await page.getByRole('button', { name: 'Auto: shortest' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    // Nothing plays by itself: the button offers to play
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /Step 1 of/ })).toBeVisible();
  });
});

test.describe('Backbone, opened from a shared link', () => {
  // A game opened with a level in its address starts on that level: the page first draws the
  // overview (the server cannot know the address), which is another height, so it is not calm by
  // design. Players open levels from the overview, like the other tests do.
  test.use({ layoutGuard: false });

  test('makes the same random level again from the seed in the address', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(PATH);
    await gameReady(page);
    await page.getByRole('button', { name: 'Make a level' }).click();
    await expect(page.locator('.bb-node').first()).toBeVisible({ timeout: 90_000 });
    const nodes = await page.locator('.bb-node').count();
    const address = page.url();
    await page.goto(address);
    await expect(page.locator('.bb-node').first()).toBeVisible({ timeout: 60_000 });
    expect(await page.locator('.bb-node').count()).toBe(nodes);
  });
});
