import { expect, gameReady, notFoundPath, pages, test } from './fixtures';

// The layout guard (layout-guard.ts) watches every browser test. This file makes sure that every
// page of the site is looked at while it loads and while it is read to the end, whatever else the
// tests do with it: a new page is part of `pages` (a build-output test fails when it is not), so it
// is covered here without writing anything. Scrolling down is part of reading: it is what shows
// images, reveals and everything else that is loaded late. Nothing may move at any moment of it.
test.use({ expectedPageStatus: 404 });

for (const path of [...pages, notFoundPath]) {
  test(`${path} stays calm while it loads and is read to the end`, async ({ page }) => {
    await page.goto(path);
    if (path.startsWith('/games/') && path !== '/games/') {
      await gameReady(page);
    }
    await page.waitForLoadState('networkidle');

    // Read down to the end in steps (and wait a moment at every step for what loads late)
    const steps = await page.evaluate(() =>
      Math.ceil(document.documentElement.scrollHeight / window.innerHeight),
    );
    for (let step = 1; step <= steps; step += 1) {
      await page.mouse.wheel(0, await page.evaluate(() => window.innerHeight));
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
    await expect(page.locator('main')).toBeVisible();
  });
}
