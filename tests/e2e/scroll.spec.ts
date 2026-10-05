import { expect, test } from './fixtures';

// Browser back during a smooth scroll must stop that scroll. Otherwise the address bar says
// "home" while the page keeps scrolling to the section that was clicked.

test.describe('scrolling and history', () => {
  test('back while scrolling to a section ends at the top, like the address bar says', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'uses the desktop navigation');
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .first()
      .getByRole('link', { name: 'Contact' })
      .click();
    // Go back while the page is still scrolling down
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.goBack();

    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 })
      .toBeLessThan(10);
    // ...and stays there instead of continuing to the old target
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(10);
  });

  test('back after arriving at a section returns to the top', async ({ page, isMobile }) => {
    test.skip(isMobile, 'uses the desktop navigation');
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .first()
      .getByRole('link', { name: 'Projects' })
      .click();
    await expect(page.locator('#projects')).toBeInViewport();
    await page.waitForTimeout(800);
    await page.goBack();
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 })
      .toBeLessThan(10);
  });
});
