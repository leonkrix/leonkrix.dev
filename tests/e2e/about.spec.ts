import type { Locator } from '@playwright/test';

import { now, siteConfig, spokenLanguages } from '../../src/lib/site';
import { expect, test } from './fixtures';

// The facts block in the About section (what is going on now, spoken languages) and the footer
// link to the source code.

test.describe('about facts', () => {
  test('shows what is going on now, how current it is, and the languages', async ({ page }) => {
    await page.goto('/');
    const facts = page.locator('#about .edge.reveal').first();
    await expect(facts).toBeAttached();
    for (const item of now.items) {
      await expect(facts.getByText(item)).toBeAttached();
    }
    await expect(facts.getByText(/^Updated [A-Z][a-z]{2} \d{4}$/)).toBeAttached();
    for (const language of spokenLanguages) {
      await expect(facts.getByText(language.name, { exact: true })).toBeAttached();
    }
  });

  test('mentions the job search only while the availability badge is shown', async ({ page }) => {
    await page.goto('/');
    const badgeVisible = await page.getByRole('link', { name: /Open to opportunities/ }).count();
    const search = page.locator('#about').getByText(now.searching);
    await expect(search).toHaveCount(badgeVisible > 0 ? 1 : 0);
  });

  test('fades in with the other blocks when scrolled into view', async ({ page }) => {
    await page.goto('/');
    const facts = page.locator('#about .edge.reveal').first();
    await facts.scrollIntoViewIfNeeded();
    await expect
      .poll(() => facts.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 4000 })
      .toBe(1);
  });
});

test.describe('footer', () => {
  test('links to the source code in a new tab, safely', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('contentinfo').getByRole('link', { name: /Source on GitHub/ });
    await expect(link).toHaveAttribute('href', siteConfig.repo);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('has the source link on the legal pages too', async ({ page }) => {
    await page.goto('/legal-notice/');
    await expect(
      page.getByRole('contentinfo').getByRole('link', { name: /Source on GitHub/ }),
    ).toBeVisible();
  });
});

/** Bounding box of an element that must exist and be visible. */
async function box(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const rect = await locator.boundingBox();
  if (rect === null) {
    throw new Error('element has no box');
  }
  return rect;
}

test.describe('layout widths', () => {
  test('the facts box is as wide as the technology grid and the project cards', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'on small screens everything is full width anyway');
    await page.goto('/');
    const facts = await box(page.locator('#about .edge.reveal').first());
    expect(facts.width).toBeGreaterThan(900);
    // The project cards sit inside the timeline gutter, so they are a little narrower
    const projectCard = await box(page.locator('#projects article').first());
    expect(facts.width).toBeGreaterThanOrEqual(projectCard.width);
    expect(facts.width - projectCard.width).toBeLessThan(60);
  });

  test('the facts box splits in the middle, in line with the technology columns below', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'on small screens the columns are stacked');
    await page.goto('/');
    const facts = page.locator('#about .edge.reveal').first();
    const languages = await box(facts.getByText('Languages', { exact: true }));
    const webAndMobile = await box(page.locator('#about h4', { hasText: 'Web & Mobile' }));
    // "Languages" starts where the second technology column starts (the box adds about 1 px of border)
    expect(Math.abs(languages.x - webAndMobile.x)).toBeLessThan(3);
    const factsBox = await box(facts);
    expect(Math.abs(languages.x - (factsBox.x + factsBox.width / 2))).toBeLessThan(40);
  });

  test('contact: text and direct contacts on the left, the form on the right', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'covered below for small screens');
    await page.goto('/');
    const intro = await box(page.locator('#contact p.reveal').first());
    const form = await box(page.locator('#contact form'));
    const direct = await box(page.getByText('Or reach me directly'));
    expect(form.x).toBeGreaterThan(intro.x + intro.width - 1);
    expect(direct.x).toBeLessThan(form.x);
    // A form stays at a comfortable width
    expect(form.width).toBeLessThan(640);
    expect(form.width).toBeGreaterThan(400);
  });

  test('contact on small screens: one column in the order text, form, direct contacts', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'covered above for wide screens');
    await page.goto('/');
    const intro = await box(page.locator('#contact p.reveal').first());
    const form = await box(page.locator('#contact form'));
    const direct = await box(page.getByText('Or reach me directly'));
    expect(form.y).toBeGreaterThan(intro.y + intro.height - 1);
    expect(direct.y).toBeGreaterThan(form.y + form.height - 1);
    expect(Math.abs(form.x - intro.x)).toBeLessThan(2);
  });
});
