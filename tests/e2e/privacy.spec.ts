import { expect, test } from '@playwright/test';

import { pages } from './fixtures';

// Protects the "no cookie banner" decision: no third-party requests, no cookies.
// The 404 page is included, it is served like every other page.
for (const path of [...pages, '/this-page-does-not-exist']) {
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

  test(`${path} stores nothing in the browser`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    // The privacy policy promises that nothing is stored on the device. This is the real check
    // behind the source scan in tests/build-output/storage-guard.test.ts.
    const stored = await page.evaluate(async () => ({
      localStorage: localStorage.length,
      sessionStorage: sessionStorage.length,
      cookie: document.cookie,
      indexedDB: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
      serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
    }));
    expect(stored).toEqual({
      localStorage: 0,
      sessionStorage: 0,
      cookie: '',
      indexedDB: 0,
      caches: 0,
      serviceWorkers: 0,
    });
  });
}
