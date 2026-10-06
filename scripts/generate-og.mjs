/**
 * Generates the Open Graph preview image (the card that appears when the link is shared) as
 * public/og.png, 1200 x 630 pixels. The image is a screenshot of a small HTML page that uses the
 * same fonts, colors and wordmark as the site, rendered with the Chromium that Playwright already
 * provides, so it needs no extra dependency. The result is committed: a build must not depend on a
 * browser. Run it again (pnpm og) after changing the name, the role, the wordmark or the colors.
 *
 * Usage: pnpm og   (needs the Playwright browser: pnpm exec playwright install chromium)
 */
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

// Node 24 runs TypeScript files directly, so the text always comes from the site configuration
import { siteConfig } from '../src/lib/site.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT = resolve('public', 'og.png');

const fontUrl = (name) =>
  pathToFileURL(resolve('node_modules', '@fontsource-variable', ...name.split('/'))).href;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Inter';
    font-weight: 100 900;
    src: url('${fontUrl('inter/files/inter-latin-wght-normal.woff2')}') format('woff2');
  }
  @font-face {
    font-family: 'JetBrains Mono';
    font-weight: 100 800;
    src: url('${fontUrl('jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2')}') format('woff2');
  }
  :root {
    --bg: #0a0d12;
    --border: #1e2632;
    --fg: #e6edf3;
    --muted: #8b98a9;
    --accent: #4f8cff;
    --accent-2: #22d3ee;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; background: var(--bg); }
  body {
    position: relative;
    overflow: hidden;
    color: var(--fg);
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  /* The same light and grid as the hero of the site */
  .light {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(900px 420px at 50% -120px, rgba(79, 140, 255, 0.2), transparent 70%),
      radial-gradient(520px 340px at 88% 8%, rgba(34, 211, 238, 0.09), transparent 70%);
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(30, 38, 50, 0.9) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(30, 38, 50, 0.9) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 75% 110% at 90% 0%, #000 0%, rgba(0, 0, 0, 0.5) 45%, transparent 100%);
  }
  .frame {
    position: absolute;
    inset: 0;
    padding: 64px 80px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .wordmark {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 34px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .wordmark svg { width: 40px; height: 40px; }
  .wordmark .cursor { color: var(--accent-2); }
  .hello {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    color: var(--accent-2);
  }
  h1 {
    margin-top: 18px;
    font-size: 132px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.03em;
  }
  .role {
    margin-top: 18px;
    font-size: 58px;
    font-weight: 500;
    background: linear-gradient(to right, var(--accent), var(--accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    width: fit-content;
  }
  .domain {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    color: var(--muted);
  }
</style>
</head>
<body>
  <div class="light"></div>
  <div class="grid"></div>
  <div class="frame">
    <div class="wordmark">
      <svg viewBox="0 0 32 32" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 10l7 6-7 6" stroke="#4f8cff"></path>
        <path d="M18 23h6" stroke="#22d3ee"></path>
      </svg>
      <span>leonkrix<span class="cursor">_</span></span>
    </div>
    <div>
      <p class="hello">Hello, I'm</p>
      <h1>${siteConfig.name}</h1>
      <p class="role">${siteConfig.role}</p>
    </div>
    <p class="domain">${new URL(siteConfig.url).hostname}</p>
  </div>
</body>
</html>`;

const directory = await mkdtemp(join(tmpdir(), 'og-'));
const page = join(directory, 'og.html');
await writeFile(page, html, 'utf8');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const tab = await context.newPage();
  await tab.goto(pathToFileURL(page).href);
  // Make sure both fonts are loaded before the picture is taken
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: OUTPUT, type: 'png' });
} finally {
  await browser.close();
  await rm(directory, { recursive: true, force: true });
}

const { size } = await stat(OUTPUT);
process.stdout.write(
  `${OUTPUT}: ${String(WIDTH)}x${String(HEIGHT)}, ${String(Math.round(size / 1024))} KB\n`,
);
