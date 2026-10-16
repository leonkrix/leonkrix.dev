import type { Page } from '@playwright/test';

import { expect, notFoundPath, pages, test } from './fixtures';

// A page must not jump when its fonts come late: on a slow line the text is first set in a font of
// the visitor's system and then again in Inter and JetBrains Mono. The fonts are requested early
// (the preload in BaseLayout) and the fallback fonts have the measures of the web fonts (the faces
// in global.css), so that the swap moves (almost) nothing. This test delays every font file by
// 1.2 seconds, opens every page and adds up the layout shifts that the browser reports (the number
// Lighthouse and Google call CLS). Without the two measures the notes and the legal pages came to
// 0.08, with them it is 0 on nearly every page; a paragraph that breaks one line earlier or later
// is about 0.03, so the limit is 0.05 (and 0.1 is what is still called good).
//
// The layout guard is off for this test, because it fails on every movement and a swap of fonts
// may move one line; the size of the movement is what is measured and limited here.
test.use({ layoutGuard: false });

const LIMIT = 0.05;
const DELAY_MS = 1200;

interface Measured {
  __shift: { shift: number };
}

/** Opens a page with delayed fonts and returns the layout shift that was reported until they were used */
async function shiftWhileFontsLoad(page: Page, path: string): Promise<number> {
  await page.route('**/*.woff2', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    await route.continue();
  });
  await page.addInitScript(() => {
    const state = { shift: 0 };
    (window as unknown as Measured).__shift = state;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) {
          state.shift += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(path);
  // The fonts have arrived and the text has been set again, and a moment more for the browser to report it
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(DELAY_MS + 600);
  return page.evaluate(() => (window as unknown as Measured).__shift.shift);
}

for (const path of pages) {
  test(`${path} stays calm when the fonts come late`, async ({ page }) => {
    const shift = await shiftWhileFontsLoad(page, path);
    expect(shift, `${path} shifted by ${shift.toFixed(4)} while its fonts loaded`).toBeLessThan(
      LIMIT,
    );
  });
}

test.describe('the 404 page', () => {
  test.use({ expectedPageStatus: 404 });

  test('stays calm when the fonts come late', async ({ page }) => {
    const shift = await shiftWhileFontsLoad(page, notFoundPath);
    expect(shift, `the 404 page shifted by ${shift.toFixed(4)}`).toBeLessThan(LIMIT);
  });
});
