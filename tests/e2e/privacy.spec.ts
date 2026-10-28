import { expect, notFoundPath, pages, test } from './fixtures';

// Protects the "no cookie banner" decision, and the promise of the privacy policy that nothing is
// stored on the device. The privacy guard (the package playwright-privacy-guard, switched on for
// every test in fixtures.ts) does the looking: it fails a test when the page talks to another
// origin, sets a cookie, stores anything (localStorage, sessionStorage, IndexedDB, Cache Storage,
// a service worker), breaks the CSP or logs an error. Here every page, the 404 page included, is
// opened on its own and has to come out clean, so a failure names the page.
// The 404 page is served like every other page (its own 404 status is expected).
test.use({ expectedPageStatus: 404 });

for (const path of [...pages, notFoundPath]) {
  test(`${path} talks only to its own origin, sets no cookies and stores nothing`, async ({
    page,
    privacy,
  }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await privacy.assertClean();
    expect(await privacy.check(), 'what the privacy guard found').toEqual([]);
  });
}
