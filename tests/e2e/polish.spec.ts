import { expect, test } from './fixtures';

// The timeline strip above the experience list and the availability badge: decoration that must
// match the data, stay out of the way of assistive technology and respect reduced motion.

test.describe('timeline strip', () => {
  test('shows every experience entry as a bar, in the right place', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the strip is for wide screens, the list below it stays on small ones');
    await page.goto('/');
    const strip = page.locator('[data-timeline]');
    await expect(strip).toBeAttached();
    await expect(strip).toHaveAttribute('aria-hidden', 'true');

    const bars = strip.locator('.tl-bar');
    const entries = page.locator('#experience h4');
    await expect(bars).toHaveCount(await entries.count());

    // The teaching assistant job starts during the bachelor's degree and ends before it
    const box = async (label: string) => {
      const bar = strip.getByText(label, { exact: true }).locator('xpath=..');
      const rect = await bar.evaluate((el) => {
        const { left, right } = el.getBoundingClientRect();
        return { left, right };
      });
      return rect;
    };
    const bachelor = await box('B.Sc.');
    const job = await box('Teaching assistant');
    const master = await box('M.Sc.');
    expect(job.left).toBeGreaterThan(bachelor.left);
    expect(job.right).toBeLessThan(bachelor.right);
    expect(master.left).toBeGreaterThanOrEqual(bachelor.right - 1);
  });

  test('has a tick for every year and a highlighted overlap', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the strip is for wide screens');
    await page.goto('/');
    const strip = page.locator('[data-timeline]');
    await expect(strip.getByText('2018', { exact: true })).toBeAttached();
    await expect(strip.getByText('2026', { exact: true })).toBeAttached();
    await expect(strip.locator('.tl-band')).toHaveCount(1);
  });

  test('is hidden on small screens, where the list tells the same story', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'covered above for wide screens');
    await page.goto('/');
    await expect(page.locator('[data-timeline]')).toBeHidden();
    await expect(page.locator('#experience li').first()).toBeAttached();
  });

  test('the bars grow in when the strip is scrolled into view and stay', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the strip is for wide screens');
    await page.goto('/');
    const bar = page.locator('[data-timeline] .tl-bar').first();
    // Waiting below the fold: collapsed
    expect(await bar.evaluate((el) => getComputedStyle(el).transform)).toMatch(/^matrix\(0,/);

    await page.locator('[data-timeline]').scrollIntoViewIfNeeded();
    await expect
      .poll(() => bar.evaluate((el) => getComputedStyle(el).transform), { timeout: 4000 })
      .toBe('none');
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows the full bars at once', async ({ page, isMobile }) => {
      test.skip(isMobile, 'the strip is for wide screens');
      await page.goto('/');
      const bar = page.locator('[data-timeline] .tl-bar').first();
      expect(await bar.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    });
  });
});

test.describe('availability badge', () => {
  test('breathes slowly and reveals an arrow on hover', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch screens have no hover');
    await page.goto('/');
    const badge = page.getByRole('link', { name: /Open to opportunities/ });
    expect(
      await badge.locator('.badge-ring').evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('badge-ring');
    expect(await badge.evaluate((el) => getComputedStyle(el).animationName)).toBe('badge-glow');

    const arrow = badge.locator('svg').last();
    await expect.poll(() => arrow.evaluate((el) => el.getBoundingClientRect().width)).toBe(0);
    await badge.hover();
    await expect
      .poll(() => arrow.evaluate((el) => el.getBoundingClientRect().width), { timeout: 2000 })
      .toBeGreaterThan(8);
  });

  test('still leads to the contact section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Open to opportunities/ }).click();
    await expect(page).toHaveURL(/#contact$/);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('stands still', async ({ page }) => {
      await page.goto('/');
      const badge = page.getByRole('link', { name: /Open to opportunities/ });
      expect(
        await badge.locator('.badge-ring').evaluate((el) => getComputedStyle(el).animationName),
      ).toBe('none');
      expect(await badge.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    });
  });
});
