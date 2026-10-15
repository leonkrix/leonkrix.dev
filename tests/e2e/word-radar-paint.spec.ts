import { expect, gameReady, test } from './fixtures';

// The words of Word Radar (about 2 MB) must be requested only after the page has been painted.
// Lighthouse counts a request that starts before the largest paint as something that paint waits
// for, and then simulates 2 MB on a slow line: the same page scored 98 or 73, depending on which
// came first by a few milliseconds (and the build server, a slower machine, made it worse). See
// `afterFirstPaint` in src/games/word-radar/data/load.ts.

for (const language of ['en', 'de'] as const) {
  test(`${language}: the words are requested after the first and the largest paint`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the order does not depend on the device');
    await page.goto(`/games/word-radar/?lang=${language}&seed=1`);
    await gameReady(page);
    await expect(page.locator('.wr-input')).toBeEnabled();

    const times = await page.evaluate(async () => {
      const largest = await new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[0] as (PerformanceEntry & { renderTime?: number }) | undefined;
          resolve(
            last === undefined
              ? -1
              : (last.renderTime ?? 0) > 0
                ? (last.renderTime ?? 0)
                : last.startTime,
          );
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const first = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1;
      const files = performance
        .getEntriesByType('resource')
        .filter((entry) => /\/_astro\/.*\.(bin|txt)$/.test(entry.name))
        .map((entry) => ({ name: entry.name.split('/').at(-1) ?? '', start: entry.startTime }));
      return { first, largest, files };
    });

    expect(times.first).toBeGreaterThan(0);
    expect(times.largest).toBeGreaterThan(0);
    // The files of the language that is played: words, numbers, hidden words (and the forms)
    expect(times.files.length).toBeGreaterThanOrEqual(3);
    for (const file of times.files) {
      expect(file.start, `${file.name} must start after the first paint`).toBeGreaterThan(
        times.first,
      );
      expect(file.start, `${file.name} must start after the largest paint`).toBeGreaterThan(
        times.largest,
      );
    }
  });
}
