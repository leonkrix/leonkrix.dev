import { expect, test as base } from '@playwright/test';

import { gamePaths } from '../../src/games/registry';

/**
 * Like Playwright's `test`, but every test automatically fails when the page logs a console
 * error, throws an exception, violates the CSP or receives an HTTP error response.
 */
export const test = base.extend<{ issues: string[] }>({
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
});

export { expect } from '@playwright/test';

/**
 * Pages that exist on the site (the 404 page is tested separately). The Playground pages are
 * included as soon as a game is live, so every test that loops over the pages covers them.
 */
export const pages: readonly string[] = ['/', '/legal-notice/', '/privacy-policy/', ...gamePaths()];
