import { siteConfig } from '../../src/lib/site';
import { expect, pages, test } from './fixtures';

test.describe('home page', () => {
  test('renders the hero and all sections', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(siteConfig.title);
    await expect(page.getByRole('heading', { level: 1, name: siteConfig.name })).toBeVisible();
    for (const id of ['about', 'projects', 'experience', 'contact']) {
      await expect(page.locator(`section#${id}`)).toBeAttached();
    }
    await expect(page.getByText('Open to opportunities')).toBeVisible();
  });

  test('turns the obfuscated email into a mailto link', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('#contact a[href^="mailto:"]');
    await expect(link).toHaveAttribute('href', `mailto:${siteConfig.email}`);
    await expect(link).toHaveText(siteConfig.email);
  });

  test('opens external profile links in a new tab safely', async ({ page }) => {
    await page.goto('/');
    const github = page.locator('#contact').getByRole('link', { name: /GitHub/ });
    await expect(github).toHaveAttribute('target', '_blank');
    await expect(github).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

test.describe('navigation', () => {
  test('desktop: header links jump to the section and the scroll-spy follows', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'covered by the mobile menu test');
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary' }).first();
    await nav.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/#projects$/);
    await expect(page.locator('#projects')).toBeInViewport();
    await expect(nav.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('mobile: the menu opens, navigates and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'desktop has the inline navigation');
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'Contact' }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#contact$/);
    await expect(page.locator('#contact')).toBeInViewport();
  });

  test('the skip link is the first focusable element and works', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('the wordmark links home from a legal page', async ({ page }) => {
    await page.goto('/impressum/');
    await page.getByRole('link', { name: 'leonkrix, home' }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('legal pages', () => {
  test('are reachable from the footer of the home page', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await footer.getByRole('link', { name: 'Impressum' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
    await page.getByRole('contentinfo').getByRole('link', { name: 'Datenschutz' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' }),
    ).toBeVisible();
  });

  test('render the address through CSS, not as text', async ({ page }) => {
    await page.goto('/impressum/');
    const address = page.getByRole('main').locator('address');
    await expect(address.locator('.ob').first()).toBeAttached();
    await expect(address).toHaveText(siteConfig.name);
  });
});

test.describe('layout', () => {
  for (const path of pages) {
    test(`${path} has no horizontal scrolling`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('stops repeating animations and smooth scrolling', async ({ page }) => {
    await page.goto('/');
    const badge = page.locator('.animate-ping').first();
    await expect(badge).toBeAttached();
    const iterations = await badge.evaluate((el) => getComputedStyle(el).animationIterationCount);
    expect(iterations).toBe('1');
    const scrollBehavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(scrollBehavior).toBe('auto');
  });
});
