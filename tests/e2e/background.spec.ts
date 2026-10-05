import { expect, test } from './fixtures';

// The background and the button effects are decoration: invisible for assistive technology, never
// in the way of clicks, and motionless for visitors who prefer reduced motion.

test.describe('animated background', () => {
  test('is hidden from assistive technology and does not catch clicks', async ({ page }) => {
    await page.goto('/');
    for (const selector of ['[data-background]', '.bg-fixed']) {
      const layer = page.locator(selector);
      await expect(layer).toHaveAttribute('aria-hidden', 'true');
      expect(await layer.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    }
    // A click on the main call to action reaches the link, not the background
    await page.getByRole('link', { name: 'View projects' }).click();
    await expect(page).toHaveURL(/#projects$/);
  });

  test('keeps text pages calm: no grid on the legal pages', async ({ page }) => {
    await page.goto('/impressum/');
    await expect(page.locator('[data-background]')).toHaveCount(0);
    await expect(page.locator('.bg-grid')).toHaveCount(0);
    // The calm color fields are still there, and never in the way
    await expect(page.locator('.bg-fixed')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the grid scrolls away with the hero, so no text sits on grid lines', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('[data-background]');
    expect(await hero.evaluate((el) => getComputedStyle(el).position)).toBe('absolute');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(hero).not.toBeInViewport();
  });

  test('the color fields drift slowly', async ({ page }) => {
    await page.goto('/');
    const name = await page
      .locator('.bg-field-a')
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).not.toBe('none');
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('stands still, but the picture is still there', async ({ page }) => {
      await page.goto('/');
      const name = await page
        .locator('.bg-field-a')
        .evaluate((el) => getComputedStyle(el).animationName);
      expect(name).toBe('none');
      await expect(page.locator('.bg-grid')).toBeAttached();
    });
  });
});

test.describe('button effects', () => {
  test('a primary button lifts on hover and is pressed on click', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch screens have no hover');
    await page.goto('/');
    const button = page.getByRole('link', { name: 'View projects' });
    const transform = () => button.evaluate((el) => getComputedStyle(el).transform);

    expect(await transform()).toBe('none');
    await button.hover();
    await expect.poll(transform).toBe('matrix(1, 0, 0, 1, 0, -1)');

    await page.mouse.down();
    await expect.poll(transform).toMatch(/^matrix\(0\.97/);
    await page.mouse.up();
  });

  test('an outline button gets an accent border on hover', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch screens have no hover');
    await page.goto('/');
    const button = page.getByRole('link', { name: 'Contact', exact: true }).first();
    const border = () => button.evaluate((el) => getComputedStyle(el).borderTopColor);

    const before = await border();
    await button.hover();
    await expect.poll(border).not.toBe(before);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('buttons do not move', async ({ page, isMobile }) => {
      test.skip(isMobile, 'touch screens have no hover');
      await page.goto('/');
      const button = page.getByRole('link', { name: 'View projects' });
      await button.hover();
      await page.waitForTimeout(300);
      expect(await button.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    });
  });
});
