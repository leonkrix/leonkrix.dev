import { expect, test } from '@playwright/test';

import { pages } from './fixtures';

// Protects the "no cookie banner" decision (see CLAUDE.md): no third-party requests, no cookies.
// The 404 page is included, it is served like every other page.
for (const path of [...pages, '/this-page-does-not-exist'] as const) {
  test(`${path} talks only to its own origin and sets no cookies`, async ({ page, context }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      requested.push(request.url());
    });

    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const origin = new URL(page.url()).origin;
    const foreign = requested.filter((url) => {
      const { protocol, origin: requestOrigin } = new URL(url);
      return protocol.startsWith('http') && requestOrigin !== origin;
    });
    expect(foreign, 'requests to other origins').toEqual([]);
    expect(await context.cookies(), 'cookies set by the site').toEqual([]);
  });
}
