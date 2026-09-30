import { expect, test } from '@playwright/test';

// Uses Playwright's own `test` on purpose: the automatic HTTP error check of the shared
// fixture would (correctly) complain about the 404 status this test expects.
test('an unknown URL shows the 404 page with a way back', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('/');
});
