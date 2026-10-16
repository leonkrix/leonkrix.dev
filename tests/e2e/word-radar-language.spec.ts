import { parseLanguage } from '../../src/games/word-radar/logic/language';
import { texts } from '../../src/games/word-radar/logic/texts';
import { expect, gameReady, test } from './fixtures';

// The language switch of Word Radar and the placeholder of the game before it is there. The page
// is static and does not know the language of the address, so it draws a placeholder in both
// languages and a script that runs at once chooses the one that is shown: the visitor sees the
// language he chose from the first frame, not English first and German when the game has loaded.

const PATH = '/games/word-radar/';

test.describe('the placeholder before the game is there', () => {
  // The game itself never arrives in these tests (its script is requested and never answered), so
  // that what the visitor sees first is what is looked at, and not what replaced it a moment later.
  test.beforeEach(async ({ page }) => {
    await page.route('**/_astro/WordRadar.*.js', () => {
      // no answer, on purpose
    });
  });

  for (const language of ['en', 'de'] as const) {
    test(`is in ${language} for ?lang=${language}, at once`, async ({ page }) => {
      const t = texts[language];
      await page.goto(`${PATH}?lang=${language}`, { waitUntil: 'domcontentloaded' });
      const skeleton = page.locator(`.wr-fallback[data-fallback-language="${language}"]`);
      await expect(skeleton).toBeVisible();
      await expect(skeleton.locator('.wr-input')).toHaveAttribute('placeholder', t.loading);
      await expect(skeleton.locator('.wr-message')).toHaveText(t.intro);
      // Only one of them is shown
      const other = language === 'en' ? 'de' : 'en';
      await expect(page.locator(`.wr-fallback[data-fallback-language="${other}"]`)).toBeHidden();
      await expect(page.locator('.wr-input:visible')).toHaveCount(1);
    });
  }

  test('says the same as the game does about every address (English unless it is ?lang=de)', async ({
    page,
  }) => {
    for (const query of [
      '',
      '?lang=de',
      '?lang=en',
      '?lang=DE',
      '?lang=',
      '?lang=fr&x=1',
      '?x=1&lang=de',
    ]) {
      await page.goto(`${PATH}${query}`, { waitUntil: 'domcontentloaded' });
      const chosen = await page.evaluate(() => document.documentElement.dataset.wrLanguage);
      expect(chosen, `the address "${query}"`).toBe(parseLanguage(query));
    }
  });
});

test.describe('the switch', () => {
  test('does not make the language that is played a link, so it cannot load the page again', async ({
    page,
  }) => {
    await page.goto(`${PATH}?lang=de&seed=1`);
    await gameReady(page);
    const german = page.locator('.wr-lang [data-wr-lang="de"]');
    const english = page.locator('.wr-lang [data-wr-lang="en"]');
    await expect(german).toHaveAttribute('aria-current', 'true');
    // Plain text, not an anchor without an address (that is not crawlable: Lighthouse lowers the SEO score)
    expect(await german.evaluate((element) => element.tagName)).toBe('SPAN');
    await expect(german).not.toHaveAttribute('href');
    await expect(english).toHaveAttribute('href', '?lang=en');
    await expect(english).not.toHaveAttribute('aria-current');

    // A click on it does nothing: the page is not loaded again and the round goes on
    await page.evaluate(() => {
      (window as unknown as { __same: boolean }).__same = true;
    });
    await german.click();
    expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(
      true,
    );
    await expect(page).toHaveURL(/lang=de/);
  });

  test('the other language is a link that goes there, and so back', async ({ page }) => {
    await page.goto(`${PATH}?seed=1`);
    await gameReady(page);
    await expect(page.locator('.wr-lang [data-wr-lang="en"]')).not.toHaveAttribute('href');
    await page.locator('.wr-lang [data-wr-lang="de"]').click();
    await expect(page).toHaveURL(/lang=de/);
    await gameReady(page);
    await expect(page.locator('.wr-input')).toHaveAttribute('placeholder', texts.de.placeholder);
    await page.locator('.wr-lang [data-wr-lang="en"]').click();
    await expect(page).toHaveURL(/lang=en/);
    await gameReady(page);
    await expect(page.locator('.wr-input')).toHaveAttribute('placeholder', texts.en.placeholder);
  });
});
