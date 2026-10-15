import { texts } from '../../src/games/word-radar/logic/texts';
import { expect, gameReady, test } from './fixtures';

// Word Radar must not move or stick out of the screen at any width, in both languages. The server
// draws the skeleton of the game in English, and when the game starts it is replaced by the game in
// the language of the address, so a label that wraps in one language and not in the other, or a
// field that is wider than the column, shows up as a jump at the moment the game starts. How soon
// a text wraps depends on the width of the screen and on the width of the letters, which differ a
// little between operating systems, so these tests look at many widths, not only at a phone.
//
// This was found when the German game jumped by 20 pixels on the build server and nowhere else: the
// field of the form was 342 px wide in a column of 272 px (the page was wider than a phone of 320
// px), and the label "Link zur Runde kopieren" wrapped where "Copy link to this round" did not.

const WIDTHS = [296, 320, 340, 360, 404, 420, 520, 600, 700, 800, 1000, 1100];

for (const language of ['en', 'de'] as const) {
  const t = texts[language];
  for (const width of WIDTHS) {
    test(`${language}: a whole round at ${String(width)} px wide, nothing moves and nothing sticks out`, async ({
      page,
      layoutShifts,
      isMobile,
    }) => {
      test.skip(isMobile, 'the widths are set here, once is enough');
      await page.setViewportSize({ width, height: 700 });
      await page.goto(`/games/word-radar/?lang=${language}&seed=20261015`);
      await gameReady(page);
      await expect(page.getByLabel(t.guessLabel)).toBeEnabled();
      const input = page.getByLabel(t.guessLabel);
      // Messages of every length, a guess that is a form of a word, a hint, giving up
      for (const word of ['qzxqzxq', 'two words', 'matratze', 'matratze', 'Hund']) {
        await input.fill(word);
        await input.press('Enter');
      }
      await page.getByRole('button', { name: t.hint(0), exact: true }).click();
      await page.getByRole('button', { name: t.giveUp }).click();
      await page.getByRole('button', { name: t.reallyGiveUp }).click();
      await expect(page.locator('.wr-result')).toBeVisible();
      await page.getByRole('button', { name: t.nearestWords }).click();
      const wider = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(wider, 'the page is wider than the screen').toBeLessThanOrEqual(0);
      expect(layoutShifts).toEqual([]);
    });
  }
}
