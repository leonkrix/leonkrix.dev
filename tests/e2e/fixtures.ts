import { mergeTests, type Page } from '@playwright/test';
import { test as guarded } from 'playwright-layout-guard';
import { test as privacyGuarded } from 'playwright-privacy-guard';

import { watchForAxe } from './axe';
import { notFoundPath, pages } from './pages';

export { notFoundPath, pages };

const escapeForRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Like Playwright's `test`, but every test is watched by two guards, which are packages of their own:
 *
 * - the layout guard (playwright-layout-guard) fails a test when anything on the page moves or changes
 *   its size; switch it off for a test with `test.use({ layoutGuard: false })` and say why;
 * - the privacy guard (playwright-privacy-guard) fails a test when the page logs a console error,
 *   throws an exception, violates the CSP, receives an HTTP error response, talks to another origin,
 *   sets a cookie or stores anything on the device. What is meant is allowed in the narrowest way that
 *   works, with `privacy.allow({ errors: [...] })` in the test, and the reason in a comment.
 *
 * A test that opens an address on purpose that answers with an error status (the 404 page) says so
 * with `test.use({ expectedPageStatus: 404 })`; that status is then fine for the address of the 404
 * page, and still not for anything it loads.
 */
export const test = mergeTests(guarded, privacyGuarded).extend<{
  expectedPageStatus: number | null;
  allowedPageStatus: undefined;
  axeGuard: undefined;
  layoutShifts: readonly unknown[];
}>({
  expectedPageStatus: [null, { option: true }],
  allowedPageStatus: [
    async ({ privacy, expectedPageStatus }, use) => {
      if (expectedPageStatus !== null) {
        privacy.allow({
          errors: [
            {
              match: new RegExp(
                `^${String(expectedPageStatus)} \\S+${escapeForRegExp(notFoundPath)}$`,
              ),
              reason: 'the 404 page is served with its status on purpose',
            },
          ],
        });
      }
      await use(undefined);
    },
    { auto: true },
  ],
  axeGuard: [
    async ({ page, privacy }, use) => {
      watchForAxe(page, privacy);
      await use(undefined);
    },
    { auto: true },
  ],
  // What the guard found so far, for the tests that look at it in the middle of a round
  layoutShifts: async ({ guard }, use) => {
    await use(guard.shifts);
  },
});

export { expect } from '@playwright/test';

/**
 * A game page shows the picture of the game (a skeleton) while the game loads, with the same
 * boxes, so that nothing moves when it appears. The skeleton looks like the game but does
 * nothing: wait until the game has taken over before using it.
 */
export async function gameReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
}
