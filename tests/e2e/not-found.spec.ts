import { expect, notFoundPath, test } from './fixtures';

// The 404 status of the page itself is expected here (the checks of the shared fixture, the layout
// guard included, still apply)
test.use({ expectedPageStatus: 404 });

test('an unknown URL shows the 404 page with a way back', async ({ page }) => {
  const response = await page.goto(notFoundPath);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('/');
});
