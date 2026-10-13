import { expect, type Page, test as base } from '@playwright/test';

import { layoutGuardScript, REPORT } from './layout-guard';
import { notFoundPath, pages } from './pages';

export { notFoundPath, pages };

/**
 * Like Playwright's `test`, but every test automatically fails when the page logs a console
 * error, throws an exception, violates the CSP or receives an HTTP error response, and when
 * anything on the page moves or changes its size (the layout guard, see layout-guard.ts; switch it
 * off for a test with `test.use({ layoutGuard: false })` and say why). A test that opens an address
 * on purpose that answers with an error status (the 404 page) says so with
 * `test.use({ expectedPageStatus: 404 })`; that status is then fine for the page itself, and still
 * not for anything it loads.
 */
export const test = base.extend<{
  issues: string[];
  layoutGuard: boolean;
  layoutShifts: string[];
  expectedPageStatus: number | null;
}>({
  layoutGuard: [true, { option: true }],
  expectedPageStatus: [null, { option: true }],
  layoutShifts: [
    async ({ page, layoutGuard }, use) => {
      const shifts: string[] = [];
      if (layoutGuard) {
        await page.exposeFunction(REPORT, (message: string) => {
          shifts.push(message);
        });
        await page.addInitScript(layoutGuardScript, REPORT);
      }
      await use(shifts);
      expect(shifts, 'something on the page moved or changed its size').toEqual([]);
    },
    { auto: true },
  ],
  issues: [
    async ({ page, expectedPageStatus }, use) => {
      const issues: string[] = [];
      page.on('console', (message) => {
        // The browser logs the error status of the page itself as a console error; the response
        // check below still catches the same status for anything the page loads
        const own =
          expectedPageStatus !== null &&
          message
            .text()
            .includes(`the server responded with a status of ${String(expectedPageStatus)}`);
        if (message.type() === 'error' && !own) {
          issues.push(`console error: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => {
        issues.push(`page error: ${error.message}`);
      });
      page.on('response', (response) => {
        const expected =
          response.request().isNavigationRequest() && response.status() === expectedPageStatus;
        if (response.status() >= 400 && !expected) {
          issues.push(`HTTP ${String(response.status())}: ${response.url()}`);
        }
      });
      await use(issues);
      expect(issues, 'unexpected console errors or failed requests').toEqual([]);
    },
    { auto: true },
  ],
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
