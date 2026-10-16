import { expect, gameReady, test } from './fixtures';

// The words of Word Radar (about 2 MB) must be requested only after the page has been painted for
// the last time. Lighthouse counts a request that starts before the largest paint it saw as
// something that paint waits for, and then simulates 2 MB on a slow line: the same page scored 98
// or 74, depending on whether the files started before or after that paint. The page has more than
// one largest paint (the text of the page, then the message of the game, which is bigger), so the
// last one counts, not the first. See `afterPaint` in src/games/word-radar/data/load.ts.

for (const language of ['en', 'de'] as const) {
  test(`${language}: the words are requested after the last largest paint and after the fonts`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the order does not depend on the device');
    await page.goto(`/games/word-radar/?lang=${language}&seed=1`);
    await gameReady(page);
    await expect(page.locator('.wr-input')).toBeEnabled();

    const times = await page.evaluate(async () => {
      type Paint = PerformanceEntry & { renderTime?: number };
      const paints = await new Promise<Paint[]>((resolve) => {
        new PerformanceObserver((list) => {
          resolve(list.getEntries());
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const timeOf = (entry: Paint): number =>
        (entry.renderTime ?? 0) > 0 ? (entry.renderTime ?? 0) : entry.startTime;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const first = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1;
      return {
        first,
        paints: paints.map(timeOf),
        fonts: resources
          .filter((entry) => entry.name.endsWith('.woff2'))
          .map((entry) => ({ name: entry.name.split('/').at(-1) ?? '', end: entry.responseEnd })),
        files: resources
          .filter((entry) => /\/_astro\/.*\.(bin|txt)$/.test(entry.name))
          .map((entry) => ({ name: entry.name.split('/').at(-1) ?? '', start: entry.startTime })),
      };
    });

    expect(times.first).toBeGreaterThan(0);
    expect(times.paints.length).toBeGreaterThan(0);
    const last = Math.max(...times.paints);
    // The files of the language that is played: words, numbers, hidden words (and the forms)
    expect(times.files.length).toBeGreaterThanOrEqual(3);
    for (const file of times.files) {
      expect(file.start, `${file.name} must start after the first paint`).toBeGreaterThan(
        times.first,
      );
      expect(file.start, `${file.name} must start after the last largest paint`).toBeGreaterThan(
        last,
      );
      for (const font of times.fonts) {
        expect(
          file.start,
          `${file.name} must start after ${font.name} has arrived`,
        ).toBeGreaterThan(font.end);
      }
    }
  });
}
