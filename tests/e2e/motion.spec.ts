import type { Locator } from '@playwright/test';

import { expect, test } from './fixtures';

// Entry motion: the hero builds up on load, blocks below the fold fade in when they are scrolled
// into view. Nothing may stay hidden for good, and visitors who prefer reduced motion (or have no
// JavaScript) get everything at once.

const opacity = (locator: Locator): Promise<number> =>
  locator.evaluate((el) => Number(getComputedStyle(el).opacity));

test.describe('hero entrance', () => {
  test('the hero elements appear one after the other and end fully visible', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1 });
    expect(await heading.evaluate((el) => getComputedStyle(el).animationName)).toBe('rise');

    const links = page.locator('.hero-in').last();
    await expect.poll(() => opacity(heading), { timeout: 3000 }).toBe(1);
    await expect.poll(() => opacity(links), { timeout: 3000 }).toBe(1);
    // After the animation the normal style applies again, so hover effects keep working
    expect(
      await page
        .getByRole('link', { name: 'View projects' })
        .evaluate((el) => getComputedStyle(el).transform),
    ).toBe('none');
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows the hero at once', async ({ page }) => {
      await page.goto('/');
      const heading = page.getByRole('heading', { level: 1 });
      expect(await heading.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
      expect(await opacity(heading)).toBe(1);
    });
  });
});

test.describe('scroll reveals', () => {
  test('blocks below the fold wait, fade in when scrolled into view and stay', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('#projects li.reveal').first();

    // Far below the fold at the start: waiting for its turn
    await expect(card).toHaveClass(/reveal-pending/);
    expect(await opacity(card)).toBe(0);

    await card.scrollIntoViewIfNeeded();
    await expect(card).not.toHaveClass(/reveal-pending/);
    await expect.poll(() => opacity(card), { timeout: 3000 }).toBe(1);

    // Scrolling away and back does not hide it again
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await card.scrollIntoViewIfNeeded();
    expect(await opacity(card)).toBe(1);
  });

  test('blocks that arrive together appear one after the other', async ({ page }) => {
    await page.goto('/');
    const groups = page.locator('#about .reveal').filter({ has: page.locator('h4') });
    await groups.first().scrollIntoViewIfNeeded();
    await expect(groups.first()).not.toHaveClass(/reveal-pending/);
    // The second block of a batch waits a moment longer
    const delays = await groups.evaluateAll((elements) =>
      elements.map((el) => (el as HTMLElement).style.transitionDelay),
    );
    expect(delays.some((delay) => delay !== '' && delay !== '0ms')).toBe(true);
  });

  test('blocks skipped by a jump to the bottom are shown, not left hidden', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    });
    // Everything above the viewport is shown at once, everything in view fades in
    await expect.poll(() => page.locator('.reveal-pending').count(), { timeout: 3000 }).toBe(0);
    const intro = page.locator('#contact .reveal').first();
    await expect.poll(() => opacity(intro), { timeout: 3000 }).toBe(1);
    const projectCard = page.locator('#projects li.reveal').first();
    expect(await opacity(projectCard)).toBe(1);
  });

  test('anchor links reveal the target section', async ({ page, isMobile }) => {
    test.skip(isMobile, 'uses the desktop navigation');
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .first()
      .getByRole('link', { name: 'Experience' })
      .click();
    const group = page.locator('#experience .reveal').nth(1);
    await expect.poll(() => opacity(group), { timeout: 4000 }).toBe(1);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('everything is visible without scrolling', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.reveal-pending')).toHaveCount(0);
      for (const locator of [
        page.locator('#projects li.reveal').first(),
        page.locator('#contact .reveal').first(),
      ]) {
        expect(await opacity(locator)).toBe(1);
      }
    });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('nothing is hidden', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.reveal-pending')).toHaveCount(0);
      expect(await opacity(page.locator('#projects li.reveal').first())).toBe(1);
      expect(await opacity(page.locator('#contact .reveal').first())).toBe(1);
    });
  });
});
