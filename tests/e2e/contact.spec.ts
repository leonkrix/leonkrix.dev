import AxeBuilder from '@axe-core/playwright';
import type { Page, Route } from '@playwright/test';

import { siteConfig } from '../../src/lib/site';
import { expect, test } from './fixtures';

// The browser tests run against the static build, so the API does not exist. Every test answers
// the two endpoints itself (page.route). The real round trip, including the mail, is tested by
// hand on a preview deployment. These tests cover what the visitor sees and does.

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello Leon, I really like your portfolio.',
};

interface Api {
  posts: Record<string, unknown>[];
  tokenRequests: number;
}

/** Answers the API: a token, and the given reply to a message. */
async function mockApi(
  page: Page,
  reply: (route: Route) => Promise<void> = (route) => route.fulfill({ json: { ok: true } }),
  token: (route: Route) => Promise<void> = (route) =>
    route.fulfill({ json: { ok: true, token: 'v1.1.test' } }),
): Promise<Api> {
  const api: Api = { posts: [], tokenRequests: 0 };
  await page.route('**/api/contact-token', (route) => {
    api.tokenRequests += 1;
    return token(route);
  });
  await page.route('**/api/contact', (route) => {
    api.posts.push(route.request().postDataJSON() as Record<string, unknown>);
    return reply(route);
  });
  return api;
}

async function fill(page: Page, values: Partial<typeof valid> = valid): Promise<void> {
  await page.getByLabel('Name', { exact: true }).fill(values.name ?? '');
  await page.getByLabel('Email', { exact: true }).fill(values.email ?? '');
  await page.getByLabel('Message', { exact: true }).fill(values.message ?? '');
}

const send = (page: Page) => page.getByRole('button', { name: /Send message/ });

test.describe('contact form', () => {
  test('is shown with JavaScript, next to the direct contact buttons', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('#contact form');
    await expect(form).toBeVisible();
    for (const label of ['Name', 'Email', 'Message']) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    const direct = page.locator('#contact').getByRole('list', { name: 'Profiles' });
    await expect(direct.getByRole('link', { name: siteConfig.email })).toHaveAttribute(
      'href',
      `mailto:${siteConfig.email}`,
    );
    await expect(direct.getByRole('link', { name: /GitHub/ })).toBeVisible();
    await expect(direct.getByRole('link', { name: /LinkedIn/ })).toBeVisible();
  });

  test('makes no API request while the visitor only reads', async ({ page }) => {
    const api = await mockApi(page);
    await page.goto('/');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    expect(api.tokenRequests).toBe(0);
    expect(api.posts).toHaveLength(0);
  });

  test('asks for the time token when the visitor starts typing', async ({ page }) => {
    const api = await mockApi(page);
    await page.goto('/');
    await page.getByLabel('Name', { exact: true }).focus();
    await expect.poll(() => api.tokenRequests).toBe(1);
    await page.getByLabel('Email', { exact: true }).focus();
    expect(api.tokenRequests).toBe(1);
  });

  test('keeps the honeypot out of sight and out of the tab order', async ({ page }) => {
    await page.goto('/');
    const honeypot = page.locator('#contact-website');
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(honeypot).toHaveAttribute('autocomplete', 'off');
    await expect(honeypot).not.toBeInViewport();
    await expect(page.locator('#contact-website').locator('..')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('shows every problem at once, focuses the first and sends nothing', async ({ page }) => {
    const api = await mockApi(page);
    await page.goto('/');
    await send(page).click();

    for (const field of ['name', 'email', 'message']) {
      await expect(page.locator(`[data-error-for="${field}"]`)).not.toBeEmpty();
      await expect(page.locator(`[name="${field}"]`)).toHaveAttribute('aria-invalid', 'true');
    }
    await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
    expect(api.posts).toHaveLength(0);
  });

  test('explains an invalid email and clears the message when it is fixed', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    const email = page.getByLabel('Email', { exact: true });
    await email.fill('not-an-email');
    await email.blur();
    await expect(page.locator('[data-error-for="email"]')).not.toBeEmpty();
    await expect(email).toHaveAttribute('aria-invalid', 'true');

    await email.fill(valid.email);
    await expect(page.locator('[data-error-for="email"]')).toBeEmpty();
    await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('counts the message characters and warns above the limit', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    const counter = page.locator('[data-message-count]');
    await expect(counter).toHaveText('0 / 2000');
    await page.getByLabel('Message', { exact: true }).fill('Hello 👋');
    await expect(counter).toHaveText('7 / 2000');
    await page.getByLabel('Message', { exact: true }).fill('x'.repeat(2001));
    await expect(counter).toHaveText('2001 / 2000');
    await expect(counter).toHaveClass(/text-danger/);
  });

  test('sends the message and confirms it', async ({ page }) => {
    const api = await mockApi(page);
    await page.goto('/');
    await fill(page);
    await send(page).click();

    const success = page.locator('[data-success]');
    await expect(success).toBeVisible({ timeout: 15_000 });
    await expect(success).toContainText('Message sent');
    await expect(success).toContainText(valid.email);
    await expect(success).toBeFocused();
    await expect(page.locator('#contact form')).toBeHidden();

    expect(api.posts).toHaveLength(1);
    expect(api.posts[0]).toEqual({ ...valid, website: '', token: 'v1.1.test' });
  });

  test('shows the sending state and blocks a second submit', async ({ page }) => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api = await mockApi(page, async (route) => {
      await gate;
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto('/');
    await fill(page);
    await send(page).click();

    const button = page.getByRole('button', { name: /Sending/ });
    await expect(button).toBeDisabled({ timeout: 15_000 });
    await expect(page.locator('#contact form')).toHaveAttribute('aria-busy', 'true');
    release?.();
    await expect(page.locator('[data-success]')).toBeVisible();
    expect(api.posts).toHaveLength(1);
  });

  test('shows the field problems the server reports', async ({ page, issues }) => {
    await mockApi(page, (route) =>
      route.fulfill({
        status: 422,
        json: {
          ok: false,
          error: 'validation',
          errors: {
            email: { code: 'invalid_email', message: 'Please enter a valid email address.' },
          },
        },
      }),
    );
    await page.goto('/');
    await fill(page);
    await send(page).click();

    await expect(page.locator('[data-error-for="email"]')).toHaveText(
      'Please enter a valid email address.',
      { timeout: 15_000 },
    );
    await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
    issues.length = 0; // the 422 is expected here
  });

  for (const [status, text] of [
    [429, /Too many messages/],
    [502, /could not be sent/],
  ] as const) {
    test(`tells the visitor what happened on HTTP ${String(status)} and keeps the text`, async ({
      page,
      issues,
    }) => {
      await mockApi(page, (route) =>
        route.fulfill({ status, json: { ok: false, error: 'x', message: 'ignored' } }),
      );
      await page.goto('/');
      await fill(page);
      await send(page).click();

      await expect(page.getByRole('alert')).toContainText(text, { timeout: 15_000 });
      await expect(send(page)).toBeEnabled();
      await expect(page.getByLabel('Message', { exact: true })).toHaveValue(valid.message);
      issues.length = 0; // the error status is expected here
    });
  }

  test('says so and disables sending when the form is switched off', async ({ page, issues }) => {
    await mockApi(page, undefined, (route) =>
      route.fulfill({ status: 503, json: { ok: false, error: 'unavailable' } }),
    );
    await page.goto('/');
    await page.getByLabel('Name', { exact: true }).focus();

    await expect(page.getByRole('alert')).toContainText(/not available right now/);
    await expect(send(page)).toBeDisabled();
    issues.length = 0; // the 503 is expected here
  });

  test('reports a network failure without losing the text', async ({ page, issues }) => {
    await mockApi(page, (route) => route.abort('failed'));
    await page.goto('/');
    await fill(page);
    await send(page).click();

    await expect(page.getByRole('alert')).toContainText(/No connection/, { timeout: 15_000 });
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(valid.name);
    issues.length = 0; // the aborted request is logged as a console error
  });

  test('can be completed with the keyboard alone', async ({ page }) => {
    const api = await mockApi(page);
    await page.goto('/');
    await page.getByLabel('Name', { exact: true }).focus();
    await page.keyboard.type(valid.name);
    await page.keyboard.press('Tab');
    await page.keyboard.type(valid.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(valid.message);
    await page.keyboard.press('Tab'); // the honeypot is skipped, so the button is next
    await expect(send(page)).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-success]')).toBeVisible({ timeout: 15_000 });
    expect(api.posts).toHaveLength(1);
  });
});

test.describe('contact form accessibility', () => {
  // Without motion, so contrast is measured on the final colors, not mid-fade
  test.use({ reducedMotion: 'reduce' });

  test('has no detectable violations while showing errors', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await send(page).click();
    await expect(page.locator('[data-error-for="name"]')).not.toBeEmpty();

    const results = await new AxeBuilder({ page })
      .include('#contact')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    const summary = results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n` +
        violation.nodes.map((node) => `  ${node.target.join(' ')}`).join('\n'),
    );
    expect(summary, 'accessibility violations').toEqual([]);
  });
});
