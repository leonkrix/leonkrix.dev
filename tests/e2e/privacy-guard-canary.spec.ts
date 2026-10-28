import { type Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { privacyGuardOptions } from './privacy-options';

// The privacy guard (the package playwright-privacy-guard, switched on in fixtures.ts) is on for
// every test, and a clean page is what it is supposed to find. That is also what it would look like
// if the wiring broke: a fixture that leaves it out, an option that switches it off, a package update
// that changes a default. Nothing would fail, the pages would just be clean. So these tests make the
// page do each wrong thing on purpose.
//
// Two kinds of test, because each answers a different question:
// - "finds" runs in report mode with the options of the site and says which rule found the thing,
//   so a wrong thing that goes unnoticed (or is found by the wrong rule) turns the test red;
// - "fails" runs with the real options and expects the test to fail (`test.fail()`), which is the
//   proof that a finding stops a test at all.

const OTHER = 'https://tracker.example';

/** Opens the home page, and answers everything that goes to the other origin without a network */
async function openHome(page: Page): Promise<void> {
  await page.route(`${OTHER}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: route.request().resourceType() === 'script' ? 'text/javascript' : 'text/plain',
      headers: { 'access-control-allow-origin': '*' },
      body: '',
    }),
  );
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

/** The things a page can do wrong, each as a function that runs in the page */
const doing = {
  'loads a script from another origin': () => {
    const script = document.createElement('script');
    script.src = 'https://tracker.example/analytics.js';
    document.head.append(script);
  },
  'sends a request to another origin (the CSP of the page blocks it)': () => {
    void fetch('https://tracker.example/collect', { method: 'POST', body: 'x' }).catch(
      () => undefined,
    );
  },
  'sets a cookie': () => {
    document.cookie = 'visitor=1; path=/';
  },
  'writes localStorage': () => {
    localStorage.setItem('theme', 'dark');
  },
  'writes sessionStorage': () => {
    sessionStorage.setItem('step', '2');
  },
  'opens an IndexedDB database': () => {
    indexedDB.open('visits');
  },
  'opens a cache': async () => {
    await caches.open('offline');
  },
  'logs an error': () => {
    console.error('something broke');
  },
  'throws an exception': () => {
    setTimeout(() => {
      throw new Error('uncaught');
    }, 0);
  },
  'asks for a file that is not there': async () => {
    await fetch('/no-such-file.js');
  },
  'breaks its own CSP': () => {
    const script = document.createElement('script');
    script.textContent = 'window.__inline = 1';
    document.head.append(script);
  },
  'asks for the location of the visitor': () => {
    navigator.geolocation.getCurrentPosition(
      () => undefined,
      () => undefined,
    );
  },
  'reads pixels back from a canvas': () => {
    const canvas = document.createElement('canvas');
    canvas.getContext('2d')?.fillRect(0, 0, 4, 4);
    canvas.toDataURL();
  },
  'adds a weak Content Security Policy': () => {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    document.head.append(meta);
  },
  'posts a form to another origin': () => {
    const form = document.createElement('form');
    form.action = 'https://tracker.example/form';
    form.method = 'post';
    document.body.append(form);
  },
} satisfies Record<string, () => unknown>;

/** Which rule has to find it */
const rules: Record<keyof typeof doing, string> = {
  'loads a script from another origin': 'requests',
  'sends a request to another origin (the CSP of the page blocks it)': 'csp',
  'sets a cookie': 'cookies',
  'writes localStorage': 'storage',
  'writes sessionStorage': 'storage',
  'opens an IndexedDB database': 'storage',
  'opens a cache': 'storage',
  'logs an error': 'errors',
  'throws an exception': 'errors',
  'asks for a file that is not there': 'errors',
  'breaks its own CSP': 'csp',
  'asks for the location of the visitor': 'apis',
  'reads pixels back from a canvas': 'fingerprint',
  'adds a weak Content Security Policy': 'cspQuality',
  'posts a form to another origin': 'forms',
};

test.describe('the privacy guard finds that a page', () => {
  // This looks at what the guard finds and does not fail the test (the next block proves that a
  // finding stops a test), with the options of the site
  test.use({ privacyGuard: { ...privacyGuardOptions, mode: 'report' } });

  for (const [what, action] of Object.entries(doing) as [keyof typeof doing, () => unknown][]) {
    test(what, async ({ page, privacy }) => {
      await openHome(page);
      expect(await privacy.check(), 'a quiet page, before anything is done').toEqual([]);
      await page.evaluate(action);
      // Give an asynchronous thing the time to arrive
      await page.waitForTimeout(300);
      const rulesFound = (await privacy.check()).map((found) => found.rule);
      expect(rulesFound).toContain(rules[what]);
    });
  }
});

test.describe('the privacy guard fails a test when a page', () => {
  test.fail();

  for (const what of ['loads a script from another origin', 'sets a cookie'] as const) {
    test(what, async ({ page }) => {
      await openHome(page);
      await page.evaluate(doing[what]);
      await page.waitForTimeout(300);
    });
  }

  test('writes localStorage, which the old test of this site also looked for', async ({ page }) => {
    await openHome(page);
    await page.evaluate(doing['writes localStorage']);
  });

  test('logs an error', async ({ page }) => {
    await openHome(page);
    await page.evaluate(doing['logs an error']);
    await page.waitForTimeout(300);
  });
});

test.describe('the privacy guard leaves a test alone when', () => {
  test('a page does what a test has allowed on purpose', async ({ page, privacy }) => {
    privacy.allow({
      cookies: [{ match: 'visitor', reason: 'this test allows it on purpose' }],
      localStorage: ['theme'],
      errors: ['something broke'],
    });
    await openHome(page);
    await page.evaluate(doing['sets a cookie']);
    await page.evaluate(doing['writes localStorage']);
    await page.evaluate(doing['logs an error']);
    await page.waitForTimeout(300);
    expect(await privacy.check()).toEqual([]);
  });
});
