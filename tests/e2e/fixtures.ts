import { expect, type Page, test as base } from '@playwright/test';

import { gamePaths } from '../../src/games/registry';
import { layoutGuardScript, REPORT } from './layout-guard';

/**
 * Like Playwright's `test`, but every test automatically fails when the page logs a console
 * error, throws an exception, violates the CSP or receives an HTTP error response, and when
 * anything on the page moves or changes its size (the layout guard, see layout-guard.ts; switch it
 * off for a test with `test.use({ layoutGuard: false })` and say why).
 */
export const test = base.extend<{ issues: string[]; layoutGuard: boolean; layoutShifts: string[] }>(
  {
    layoutGuard: [true, { option: true }],
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
      async ({ page }, use) => {
        const issues: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') {
            issues.push(`console error: ${message.text()}`);
          }
        });
        page.on('pageerror', (error) => {
          issues.push(`page error: ${error.message}`);
        });
        page.on('response', (response) => {
          if (response.status() >= 400) {
            issues.push(`HTTP ${String(response.status())}: ${response.url()}`);
          }
        });
        await use(issues);
        expect(issues, 'unexpected console errors or failed requests').toEqual([]);
      },
      { auto: true },
    ],
  },
);

export { expect } from '@playwright/test';

/**
 * Pages that exist on the site (the 404 page is tested separately). The Playground pages are
 * included as soon as a game is live, so every test that loops over the pages covers them.
 */
export const pages: readonly string[] = ['/', '/legal-notice/', '/privacy-policy/', ...gamePaths()];

/**
 * A game page shows the picture of the game (a skeleton) while the game loads, with the same
 * boxes, so that nothing moves when it appears. The skeleton looks like the game but does
 * nothing: wait until the game has taken over before using it.
 */
export async function gameReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
}
