import { expect, test } from './fixtures';

// The privacy policy of the WhyMail app, which is entered in the Play Console. It is read on phones
// (from the store listing), so the table of the network must never make the page wider than the screen.

const path = '/whymail/datenschutz/';

test('shows English first and German second, and the jump links work', async ({ page }) => {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy policy of WhyMail');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Datenschutzerklärung WhyMail',
  );

  const english = page.locator('section[lang="en"]');
  const german = page.locator('section[lang="de"]');
  const englishBox = await english.boundingBox();
  const germanBox = await german.boundingBox();
  expect(englishBox && germanBox && germanBox.y > englishBox.y).toBe(true);

  await page.getByRole('link', { name: 'German version' }).click();
  await expect(page).toHaveURL(/#de$/);
  await expect(german).toBeInViewport();
});

test('names the publisher without the address or the email being text, and links the legal notice', async ({
  page,
}) => {
  await page.goto(path);
  const english = page.locator('section[lang="en"]');
  const publisher = english.locator('address');
  await expect(publisher).toContainText('Legal notice');
  await expect(publisher.getByRole('link', { name: 'leonkrix.dev/legal-notice' })).toHaveAttribute(
    'href',
    '/legal-notice/',
  );
  // The email address becomes a link only with JavaScript, and is a real link then
  await expect(publisher.getByRole('link', { name: 'whymail.app@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:whymail.app@gmail.com',
  );
  // Visiting this site is covered by the policy of the site
  await expect(page.getByRole('link', { name: 'privacy policy of leonkrix.dev' })).toHaveAttribute(
    'href',
    '/privacy-policy/',
  );
});

test('the table of the network can be reached with the keyboard and the page does not scroll sideways on a small screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(path);
  const table = page.locator('section[lang="en"]').getByRole('region', {
    name: 'What the app sends over the network',
  });
  await table.scrollIntoViewIfNeeded();
  await table.focus();
  await expect(table).toBeFocused();
  // The table is wider than the screen and scrolls inside its own region
  const [scrollWidth, clientWidth] = await table.evaluate((element) => [
    element.scrollWidth,
    element.clientWidth,
  ]);
  expect(scrollWidth).toBeGreaterThan(clientWidth);

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);
});
