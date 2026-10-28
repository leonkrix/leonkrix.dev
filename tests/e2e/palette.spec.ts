import type { Page } from '@playwright/test';

import { siteConfig } from '../../src/lib/site';
import AxeBuilder from './axe';
import { expect, notFoundPath, test } from './fixtures';

// The command palette (Ctrl or Cmd + K) with its terminal mode, the terminal of the 404 page and
// the Konami code. Everything is fetched when the palette is opened first, so these tests also
// check that nothing of it is on the page before.

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Search and commands' });
const field = (page: Page) => dialog(page).getByRole('combobox');
const terminalField = (page: Page) =>
  dialog(page).getByRole('textbox', { name: 'Terminal command' });

async function openWithKeyboard(page: Page, key = 'Control+k'): Promise<void> {
  await page.keyboard.press(key);
  await expect(dialog(page)).toBeVisible();
}

test.describe('search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('is not on the page until it is asked for', async ({ page }) => {
    await expect(page.locator('dialog')).toHaveCount(0);
    const scripts = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => /\/(palette-ui|terminal-ui|radar)\.[^/]*\.(js|css)$/.test(name)),
    );
    expect(scripts).toEqual([]);
  });

  test('opens with Ctrl+K and with Cmd+K, puts the cursor in the field and closes with Escape', async ({
    page,
  }) => {
    await openWithKeyboard(page);
    await expect(field(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();

    await openWithKeyboard(page, 'Meta+k');
    await page.keyboard.press('Control+k');
    await expect(dialog(page)).toBeHidden();
  });

  test('opens with the button in the header and goes back to it when it closes', async ({
    page,
  }) => {
    const button = page.getByRole('button', { name: 'Search and commands' });
    await button.click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
  });

  test('closes with the Esc button and with a click on the dark area', async ({ page }) => {
    await openWithKeyboard(page);
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await expect(dialog(page)).toBeHidden();

    await openWithKeyboard(page);
    await page.mouse.click(2, 2);
    await expect(dialog(page)).toBeHidden();
  });

  test('lists the places, games, notes and projects in groups', async ({ page }) => {
    await openWithKeyboard(page);
    for (const group of ['Go to', 'Games', 'Notes', 'Projects', 'Actions', 'Links', 'Legal']) {
      await expect(dialog(page).getByRole('group', { name: group })).toBeAttached();
    }
    await expect(
      dialog(page)
        .getByRole('option', { name: /^Word Radar/ })
        .first(),
    ).toBeAttached();
    await expect(dialog(page).getByRole('option', { name: /^Uses/ })).toBeAttached();
  });

  test('filters while typing, says how many results there are and has a message for none', async ({
    page,
  }) => {
    await openWithKeyboard(page);
    await field(page).fill('defuze');
    await expect(dialog(page).getByRole('option')).toHaveCount(1);
    await expect(dialog(page).getByRole('status').first()).toHaveText('1 result');

    await field(page).fill('qwertzuiop');
    await expect(dialog(page).getByRole('option')).toHaveCount(0);
    await expect(dialog(page).getByText('Nothing found')).toBeVisible();
    await expect(dialog(page).getByRole('status').first()).toHaveText('No results');
    await expect(field(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('moves through the list with the arrow keys, and announces the entry for a screen reader', async ({
    page,
  }) => {
    await openWithKeyboard(page);
    const first = dialog(page).getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(first).toHaveAttribute('aria-selected', 'false');
    const second = dialog(page).getByRole('option').nth(1);
    await expect(second).toHaveAttribute('aria-selected', 'true');
    const id = await second.getAttribute('id');
    await expect(field(page)).toHaveAttribute('aria-activedescendant', id ?? '');
    // wraps around at the top
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(dialog(page).getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
  });

  test('opens the chosen place with Enter', async ({ page }) => {
    await openWithKeyboard(page);
    await field(page).fill('uses');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/uses/');
  });

  test('opens a project card on the home page, and a note, with a click', async ({ page }) => {
    await openWithKeyboard(page);
    await field(page).fill('defuze');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/#project-defuze');

    await openWithKeyboard(page);
    await field(page).fill('never moves');
    await dialog(page)
      .getByRole('option', { name: /A page that never moves/ })
      .click();
    await expect(page).toHaveURL('/notes/a-page-that-never-moves/');
  });

  test('plays a random game', async ({ page }) => {
    await openWithKeyboard(page);
    await field(page).fill('random');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/games\/[a-z-]+\/$/);
  });

  test('opens a link in a new tab', async ({ page, context }) => {
    await openWithKeyboard(page);
    await field(page).fill('source code');
    const popup = context.waitForEvent('page');
    await page.keyboard.press('Enter');
    const tab = await popup;
    expect(tab.url()).toContain('github.com/leonkrix');
    await tab.close();
  });

  test('copies the email address and tells so', async ({ page, context, browserName, privacy }) => {
    test.skip(browserName !== 'chromium', 'the clipboard permission is a Chromium feature');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    privacy.allow({
      apis: [
        {
          match: 'clipboard-read',
          reason: 'the test reads what was copied; the site only writes to the clipboard',
        },
      ],
    });
    await openWithKeyboard(page);
    await field(page).fill('copy');
    await page.keyboard.press('Enter');
    await expect(dialog(page).getByText('Email address copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(siteConfig.email);
  });

  test('keeps the page where it is while it opens, filters and closes', async ({ page }) => {
    await page.evaluate(() => {
      window.scrollTo({ top: 600, behavior: 'instant' });
    });
    const before = await page.evaluate(() => ({
      y: window.scrollY,
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    await openWithKeyboard(page);
    await field(page).fill('note');
    await page.keyboard.press('Escape');
    const after = await page.evaluate(() => ({
      y: window.scrollY,
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    expect(after).toEqual(before);
  });
});

test.describe('terminal mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openWithKeyboard(page);
    await field(page).fill('>');
    await expect(terminalField(page)).toBeFocused();
  });

  test('turns the field into a prompt and lists the commands with help', async ({ page }) => {
    await expect(dialog(page).getByRole('log')).toContainText('Type "help"');
    await terminalField(page).fill('help');
    await page.keyboard.press('Enter');
    const log = dialog(page).getByRole('log');
    await expect(log).toContainText('neofetch');
    await expect(log).toContainText('copy my email address');
    await expect(terminalField(page)).toHaveValue('');
  });

  test('runs commands that print: git log, neofetch, projects', async ({ page }) => {
    const log = dialog(page).getByRole('log');
    await terminalField(page).fill('neofetch');
    await page.keyboard.press('Enter');
    await expect(log).toContainText('leon@leonkrix.dev');
    await terminalField(page).fill('projects');
    await page.keyboard.press('Enter');
    await expect(log.getByRole('link', { name: 'Defuze' })).toBeVisible();
    await terminalField(page).fill('git log');
    await page.keyboard.press('Enter');
    await expect(log).toContainText(/[0-9a-f]{7} \S+/);
  });

  test('knows the jokes and an unknown command', async ({ page }) => {
    const log = dialog(page).getByRole('log');
    await terminalField(page).fill('sudo hire leon');
    await page.keyboard.press('Enter');
    await expect(log).toContainText('Permission granted.');
    await terminalField(page).fill('frobnicate');
    await page.keyboard.press('Enter');
    await expect(log).toContainText('frobnicate: command not found');
  });

  test('goes to a page with open, and closes with exit', async ({ page }) => {
    await terminalField(page).fill('open uses');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/uses/');
  });

  test('completes with Tab and walks through the history with the arrow keys', async ({ page }) => {
    await terminalField(page).fill('pro');
    await page.keyboard.press('Tab');
    await expect(terminalField(page)).toHaveValue('projects ');
    await page.keyboard.press('Enter');
    await terminalField(page).fill('whoami');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await expect(terminalField(page)).toHaveValue('whoami');
    await page.keyboard.press('ArrowUp');
    await expect(terminalField(page)).toHaveValue('projects ');
    await page.keyboard.press('ArrowDown');
    await expect(terminalField(page)).toHaveValue('whoami');
  });

  test('clears the screen and leaves with exit', async ({ page }) => {
    const log = dialog(page).getByRole('log');
    await terminalField(page).fill('whoami');
    await page.keyboard.press('Enter');
    await terminalField(page).fill('clear');
    await page.keyboard.press('Enter');
    await expect(log.locator('.term-line')).toHaveCount(0);
    await terminalField(page).fill('exit');
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeHidden();
  });

  test('goes back to the search with Backspace on an empty line', async ({ page }) => {
    await page.keyboard.press('Backspace');
    await expect(field(page)).toBeFocused();
    await expect(dialog(page).getByRole('option').first()).toBeVisible();
  });

  test('keeps what was printed when the palette is closed and opened again', async ({ page }) => {
    await terminalField(page).fill('whoami');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await openWithKeyboard(page);
    await field(page).fill('>');
    await expect(dialog(page).getByRole('log')).toContainText('visitor');
  });

  test('opens from the entry Open the terminal', async ({ page }) => {
    await page.keyboard.press('Escape');
    await openWithKeyboard(page);
    await field(page).fill('terminal');
    await page.keyboard.press('Enter');
    await expect(terminalField(page)).toBeFocused();
  });

  test('the box has the same size in search and in terminal mode, and when it prints', async ({
    page,
  }) => {
    const box = async () => dialog(page).boundingBox();
    // the box grows from a little smaller while it opens: measure it when it has settled
    await dialog(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const terminal = await box();
    for (let line = 0; line < 30; line += 1) {
      await terminalField(page).fill('help');
      await page.keyboard.press('Enter');
    }
    expect(await box()).toEqual(terminal);
    await page.keyboard.press('Backspace');
    expect(await box()).toEqual(terminal);
  });
});

test.describe('the terminal of the 404 page', () => {
  test.use({ expectedPageStatus: 404 });

  test('answers commands, and a click in the box goes to the field', async ({ page }) => {
    await page.goto(notFoundPath);
    const log = page.getByRole('log', { name: 'Terminal' });
    await expect(log).toContainText('No such file or directory');
    await page.locator('[data-terminal]').click({ position: { x: 20, y: 20 } });
    await expect(page.getByRole('textbox', { name: 'Terminal command' })).toBeFocused();
    await page.keyboard.type('ls');
    await page.keyboard.press('Enter');
    await expect(log).toContainText('about.txt');
    await page.keyboard.type('sudo hire leon');
    await page.keyboard.press('Enter');
    await expect(log).toContainText('Permission granted.');
  });

  test('is used before its code has arrived: Enter right after the first key still runs', async ({
    page,
  }) => {
    await page.goto(notFoundPath);
    const log = page.getByRole('log', { name: 'Terminal' });
    await page.getByRole('textbox', { name: 'Terminal command' }).fill('whoami');
    await page.getByRole('textbox', { name: 'Terminal command' }).press('Enter');
    await expect(log).toContainText('visitor');
  });

  test('does not take the focus when the page opens, but typing anywhere goes to the field', async ({
    page,
  }) => {
    await page.goto(notFoundPath);
    const field = page.getByRole('textbox', { name: 'Terminal command' });
    await expect(field).not.toBeFocused();
    await page.keyboard.type('whoami');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('whoami');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('log', { name: 'Terminal' })).toContainText('visitor');
  });

  test('fits a laptop screen without a scroll bar, and the footer stays at the bottom', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'a phone is held in the other direction as well');
    for (const [width, height] of [
      [1280, 720],
      [1366, 650],
      [1024, 768],
      [1920, 1080],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(notFoundPath);
      const sizes = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        window: window.innerHeight,
        footerBottom: document.querySelector('footer')?.getBoundingClientRect().bottom ?? 0,
      }));
      expect(sizes.scroll, `${String(width)}x${String(height)} scrolls`).toBeLessThanOrEqual(
        sizes.window,
      );
      expect(Math.round(sizes.footerBottom)).toBe(sizes.window);
    }
  });

  test('opens a page with cd', async ({ page }) => {
    await page.goto(notFoundPath);
    await page.getByRole('textbox', { name: 'Terminal command' }).fill('cd notes');
    await page.getByRole('textbox', { name: 'Terminal command' }).press('Enter');
    await expect(page).toHaveURL('/notes/');
  });

  test('has no accessibility violations with output on the screen', async ({ page }) => {
    await page.goto(notFoundPath);
    await page.getByRole('textbox', { name: 'Terminal command' }).fill('help');
    await page.getByRole('textbox', { name: 'Terminal command' }).press('Enter');
    await expect(page.getByRole('log', { name: 'Terminal' })).toContainText('neofetch');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

test.describe('accessibility with the palette open', () => {
  test.use({ reducedMotion: 'reduce' });

  test('has no violations in search mode and in terminal mode', async ({ page }) => {
    await page.goto('/');
    await openWithKeyboard(page);
    await expect(dialog(page).getByRole('option').first()).toBeVisible();
    let results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    await field(page).fill('zzzzzz');
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    await field(page).fill('>');
    await terminalField(page).fill('help');
    await page.keyboard.press('Enter');
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

test.describe('the Konami code', () => {
  const code = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
  ];

  const radarPanel = (page: Page) => page.getByRole('region', { name: /The radar found/ });

  async function runCode(page: Page): Promise<void> {
    for (const key of code) {
      await page.keyboard.press(key);
    }
  }

  test('turns a beam, lights up what is on the screen and then lists what the page has', async ({
    page,
  }) => {
    await page.goto('/');
    await runCode(page);
    await expect(page.locator('.radar-beam')).toBeAttached();
    // The badge in the hero is on the screen: it lights up with its label, when the beam arrives
    await expect(
      page.locator('.radar-ping-label', { hasText: 'Open to opportunities' }),
    ).toBeAttached();
    const delays = await page
      .locator('.radar-ping')
      .evaluateAll((pings) =>
        pings.map((ping) => parseFloat(getComputedStyle(ping).animationDelay)),
      );
    expect(delays.length).toBeGreaterThan(0);
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(2.2);
    }

    const panel = radarPanel(page);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('worth a look on this page');
    await expect(panel.getByRole('button', { name: 'Open to opportunities' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'The games' })).toBeVisible();
    await expect(panel.getByRole('button', { name: /^Key figures: / }).first()).toBeVisible();
    await expect(page.locator('.radar-beam')).toHaveCount(0);
    await expect(panel).toBeFocused();
  });

  test('goes to a find when it is chosen in the list, and lights it up there', async ({ page }) => {
    await page.goto('/');
    await runCode(page);
    const panel = radarPanel(page);
    await panel.getByRole('button', { name: 'Email, GitHub and LinkedIn' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const box = document.querySelector('[data-radar="Email, GitHub and LinkedIn"]');
          const rect = box?.getBoundingClientRect();
          return rect !== undefined && rect.top >= 0 && rect.bottom <= window.innerHeight;
        }),
      )
      .toBe(true);
    await expect(
      page.locator('.radar-ping-label', { hasText: 'Email, GitHub and LinkedIn' }),
    ).toBeAttached();
  });

  test('puts the frame exactly on the thing, also after a long scroll to a block that fades in', async ({
    page,
  }) => {
    // Far from each other, so that every click scrolls smoothly for a while, and the blocks that
    // fade in when they are reached are still rising when the page arrives
    test.setTimeout(90_000);
    await page.goto('/');
    await runCode(page);
    const panel = radarPanel(page);
    const centre = (box: { x: number; y: number; width: number; height: number } | null) =>
      box === null ? null : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    for (const label of [
      'Contact form',
      'What I am doing now',
      'Key figures: Defuze',
      'The games',
      'Key figures: leonkrix.dev',
      'Email, GitHub and LinkedIn',
    ]) {
      await panel.getByRole('button', { name: label, exact: true }).click();
      const frame = page.locator('.radar-ping', { hasText: label });
      await expect(frame).toBeAttached({ timeout: 8000 });
      // The first look at the frame, and two more while it is visible: the same place every time
      for (let sample = 0; sample < 3; sample += 1) {
        const [frameBox, target] = await Promise.all([
          frame.boundingBox(),
          page.locator(`[data-radar="${label}"]`).boundingBox(),
        ]);
        const a = centre(frameBox);
        const b = centre(target);
        expect(a, `${label}: no frame`).not.toBeNull();
        expect(
          Math.abs((a?.x ?? 1e9) - (b?.x ?? 0)),
          `${label} sample ${String(sample)} (x)`,
        ).toBeLessThan(2);
        expect(
          Math.abs((a?.y ?? 1e9) - (b?.y ?? 0)),
          `${label} sample ${String(sample)} (y)`,
        ).toBeLessThan(2);
        await page.waitForTimeout(150);
      }
    }
  });

  test('closes with Escape or the button, and one run replaces the one before', async ({
    page,
  }) => {
    await page.goto('/');
    await runCode(page);
    await expect(radarPanel(page)).toBeVisible();
    await runCode(page);
    await expect(radarPanel(page)).toHaveCount(1);
    await expect(radarPanel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(radarPanel(page)).toHaveCount(0);

    await runCode(page);
    await expect(radarPanel(page)).toBeVisible();
    await page.getByRole('button', { name: 'Close the radar' }).click();
    await expect(radarPanel(page)).toHaveCount(0);
  });

  test.describe('on every kind of page', () => {
    // Only the list is of interest here, and without the beam six pages take seconds, not a minute
    test.use({ reducedMotion: 'reduce' });

    test('finds something', async ({ page }) => {
      for (const [path, label] of [
        ['/uses/', 'My setup in short'],
        ['/notes/word-radar/', 'Key figures'],
        ['/notes/word-radar/', 'Play Word Radar'],
        // Not Word Radar: its page puts the cursor into the guess field when it is ready, and the
        // Konami code is not taken while somebody types in a field
        ['/games/link-up/', 'The game'],
        ['/legal-notice', 'Source code on GitHub'],
      ] as const) {
        await page.goto(path);
        await runCode(page);
        await expect(
          radarPanel(page).getByRole('button', { name: label, exact: true }),
          `${path} lists ${label}`,
        ).toBeVisible();
        await page.keyboard.press('Escape');
      }
    });
  });

  test('does not start when a key is wrong or while typing in a field', async ({ page }) => {
    await page.goto('/');
    for (const key of [...code.slice(0, 5), 'x', ...code.slice(5)]) {
      await page.keyboard.press(key);
    }
    await expect(page.locator('.radar-beam')).toHaveCount(0);

    await openWithKeyboard(page);
    await runCode(page);
    await expect(page.locator('.radar-beam')).toHaveCount(0);
    await expect(radarPanel(page)).toHaveCount(0);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows only the list at once, no beam and no frames', async ({ page }) => {
      await page.goto('/');
      await runCode(page);
      await expect(radarPanel(page)).toBeVisible();
      await expect(page.locator('.radar-beam, .radar, .radar-ping')).toHaveCount(0);
      await expect(
        radarPanel(page).getByRole('button', { name: 'Open to opportunities' }),
      ).toBeVisible();
    });

    test('has no accessibility violations with the list open', async ({ page }) => {
      await page.goto('/');
      await runCode(page);
      await expect(radarPanel(page)).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  });

  test('the terminal command radar does the same, also on the 404 page', async ({ page }) => {
    await page.goto('/');
    await openWithKeyboard(page);
    await field(page).fill('>');
    await terminalField(page).fill('radar');
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeHidden();
    await expect(radarPanel(page)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test.describe('on the 404 page', () => {
    test.use({ expectedPageStatus: 404 });

    test('lists the terminal and the way back', async ({ page }) => {
      await page.goto(notFoundPath);
      await page.getByRole('textbox', { name: 'Terminal command' }).fill('radar');
      await page.getByRole('textbox', { name: 'Terminal command' }).press('Enter');
      const panel = radarPanel(page);
      await expect(panel.getByRole('button', { name: 'The terminal' })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Back to the home page' })).toBeVisible();
    });
  });
});

test.describe('the hello for developers', () => {
  test('is in the console, with a link to the source', async ({ page }) => {
    const messages: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'info') {
        messages.push(message.text());
      }
    });
    await page.goto('/');
    await expect.poll(() => messages.join('\n')).toContain(siteConfig.repo);
  });
});
