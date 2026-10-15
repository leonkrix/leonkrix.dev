import { usesCategories, usesSummary } from '../../src/lib/uses';
import { expect, test } from './fixtures';

// The Uses page: a terminal block with the short version, then a card per category. Everything
// must be readable, fit the screen, and the animation of the block must end with everything shown.

test('shows the summary and every category with its items', async ({ page }) => {
  await page.goto('/uses/');
  await expect(page.getByRole('heading', { level: 1, name: 'What I work with' })).toBeVisible();

  const summary = page.locator('.uses-terminal dl');
  for (const line of usesSummary) {
    await expect(summary.getByText(line.label, { exact: true })).toBeVisible();
    await expect(summary.getByText(line.value, { exact: true })).toBeVisible();
  }

  for (const category of usesCategories) {
    const card = page.getByRole('region', { name: category.title });
    await expect(card).toBeVisible();
    for (const item of category.items) {
      await expect(card.getByText(item.name, { exact: true })).toBeVisible();
    }
  }
});

test('is reached from the footer of the home page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Uses' }).click();
  await expect(page).toHaveURL('/uses/');
});

test('the terminal lines end fully visible, and the page does not scroll sideways', async ({
  page,
}) => {
  await page.goto('/uses/');
  const last = page.locator('.uses-line').last();
  await expect
    .poll(() => last.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 5000 })
    .toBe(1);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(sideways).toBe(false);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the whole block at once, without an animation', async ({ page }) => {
    await page.goto('/uses/');
    for (const selector of ['.uses-typed', '.uses-line']) {
      const style = await page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const computed = getComputedStyle(el);
          return { animation: computed.animationName, opacity: computed.opacity };
        });
      expect(style, selector).toEqual({ animation: 'none', opacity: '1' });
    }
  });
});

test('types the command character by character, with the caret in front of the revealed part', async ({
  page,
}) => {
  await page.goto('/uses/');
  // Stop the animation and look at three moments: the mask must open in steps. A mask that goes
  // from "inset" to "none" cannot be stepped, the browser jumps, and the whole command appears at
  // once (that is how it was first built).
  const reveal = await page.locator('.uses-typed').evaluate((element) => {
    const animation = element
      .getAnimations()
      .find((entry) => entry instanceof CSSAnimation && entry.animationName === 'uses-type');
    if (animation === undefined) {
      return [];
    }
    animation.pause();
    const delay = animation.effect?.getTiming().delay ?? 0;
    return [0.2, 0.5, 0.8].map((share) => {
      animation.currentTime = delay + 900 * share;
      const match = /inset\(0(?:px)? ([\d.]+)%/.exec(getComputedStyle(element).clipPath);
      return match === null ? Number.NaN : Number(match[1]);
    });
  });
  expect(reveal).toHaveLength(3);
  // A growing part of the text is shown (the hidden share on the right shrinks)
  expect(reveal[0]).toBeLessThan(100);
  expect(reveal[0]).toBeGreaterThan(reveal[1] ?? 0);
  expect(reveal[1]).toBeGreaterThan(reveal[2] ?? 0);
  expect(reveal[2]).toBeGreaterThan(0);
});
