import { type Page } from '@playwright/test';

import { expect, test } from './fixtures';

// The layout guard (the package playwright-layout-guard, switched on in fixtures.ts) is on for every
// test, and a calm page is what it is supposed to find. That is also what it would look like if the
// wiring broke: a fixture that leaves it out, an option that switches it off, a package update that
// changes a default. Nothing would fail, the pages would just be calm. So these tests make the page
// move on purpose, and the guard must fail them. `test.fail()` turns the expected failure into a
// pass, and a guard that does not notice turns it into a red test.

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Past the first moments after the load, in which the guard still takes in the page
  await page.waitForTimeout(500);
}

test.describe('the guard fails a test when', () => {
  test.fail();

  test('a banner pushes the page down', async ({ page }) => {
    await openHome(page);
    await page.evaluate(() => {
      const banner = document.createElement('div');
      banner.style.height = '48px';
      document.body.insertBefore(banner, document.body.firstChild);
    });
    await page.waitForTimeout(600);
  });

  test('a block moves sideways', async ({ page }) => {
    await openHome(page);
    await page.evaluate(() => {
      const block = document.querySelector<HTMLElement>('main > *');
      if (block) {
        block.style.position = 'relative';
        block.style.marginLeft = '12px';
        block.style.left = '12px';
      }
    });
    await page.waitForTimeout(600);
  });

  test('the page gets lower (the option pageHeight: any of this site)', async ({ page }) => {
    await openHome(page);
    await page.evaluate(() => {
      document.body.lastElementChild?.remove();
    });
    await page.waitForTimeout(600);
  });

  test('something is added at the end of the page', async ({ page }) => {
    await openHome(page);
    await page.evaluate(() => {
      const extra = document.createElement('div');
      extra.style.height = '300px';
      document.body.append(extra);
    });
    await page.waitForTimeout(600);
  });
});

test.describe('the guard leaves a test alone when', () => {
  test('the page is scrolled and the window is resized', async ({ page }) => {
    await openHome(page);
    await page.evaluate(() => {
      window.scrollTo(0, 600);
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForTimeout(800);
    await expect(page.locator('main')).toBeVisible();
  });

  test('something moves with a transform, which is not a layout change', async ({ page }) => {
    await openHome(page);
    await page.evaluate(() => {
      const block = document.querySelector<HTMLElement>('main > *');
      if (block) {
        block.style.transform = 'translateY(40px)';
      }
    });
    await page.waitForTimeout(600);
    await expect(page.locator('main')).toBeVisible();
  });
});
