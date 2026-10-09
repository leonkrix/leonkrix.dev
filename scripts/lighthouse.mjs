/**
 * Quality gate: runs Lighthouse (mobile preset, simulated slow 4G and CPU throttling) against the
 * production build served by `astro preview`, three times, and takes the median.
 * Fails when a category score is below its threshold or a budget is exceeded.
 *
 * Usage: pnpm lighthouse   (builds first)
 * Needs a Chrome or Chromium; set CHROME_PATH if it is not found automatically.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, writeFile } from 'node:fs/promises';

import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const PORT = 4323;
const ORIGIN = `http://localhost:${String(PORT)}`;
const HOME_URL = `${ORIGIN}/`;
const RUNS = 3;
const REPORT_DIR = 'lighthouse-report';

/** Every category must reach this score (0 to 1). */
const MIN_SCORE = 0.95;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

/**
 * Budgets in bytes of transferred data. The preview server does not compress, so these are
 * conservative. Measured on 2026-10-01 (with the contact form): scripts 4.5 KB, stylesheets 7.1 KB, total 134 KB.
 */
const BUDGETS = {
  script: 10 * 1024,
  stylesheet: 20 * 1024,
  total: 200 * 1024,
};

/**
 * Budgets of the game pages by slug (src/games/<slug>), in bytes. A live game must have an entry
 * here: set it deliberately from a measurement (React and the game's own script are the big part).
 * Without an entry the run fails, so a game cannot go live without a budget.
 */
const GAME_BUDGETS = {};

/** The pages to test: the home page, and the Playground pages once a game is live. */
async function listPages() {
  const pages = [{ path: '/', budgets: BUDGETS }];
  if (existsSync('dist/games/index.html')) {
    pages.push({ path: '/games/', budgets: BUDGETS });
  }
  if (existsSync('dist/games')) {
    const folders = await readdir('dist/games', { withFileTypes: true });
    for (const folder of folders.filter((entry) => entry.isDirectory())) {
      const budgets = GAME_BUDGETS[folder.name];
      if (!budgets) {
        throw new Error(
          `The game "${folder.name}" has no entry in GAME_BUDGETS (scripts/lighthouse.mjs).`,
        );
      }
      pages.push({ path: `/games/${folder.name}/`, budgets });
    }
  }
  return pages;
}

const log = (message) => process.stdout.write(`${message}\n`);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(HOME_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The preview server did not start on ${ORIGIN}.`);
}

function summarize(lhr) {
  const scores = Object.fromEntries(CATEGORIES.map((id) => [id, lhr.categories[id]?.score ?? 0]));
  const summary = lhr.audits['resource-summary']?.details?.items ?? [];
  const bytes = (type) => summary.find((item) => item.resourceType === type)?.transferSize ?? 0;
  const requests = lhr.audits['network-requests']?.details?.items ?? [];
  const foreignRequests = requests.filter((item) => new URL(item.url).origin !== ORIGIN).length;
  return {
    scores,
    script: bytes('script'),
    stylesheet: bytes('stylesheet'),
    total: bytes('total'),
    foreignRequests,
  };
}

const server = spawn(
  process.execPath,
  ['node_modules/astro/bin/astro.mjs', 'preview', '--port', String(PORT)],
  { stdio: 'ignore' },
);
let chrome;
let exitCode = 0;

try {
  await waitForServer();
  chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    ...(process.env.CHROME_PATH ? { chromePath: process.env.CHROME_PATH } : {}),
  });

  await mkdir(REPORT_DIR, { recursive: true });

  const failures = [];
  const lines = [];
  const summaries = {};

  for (const { path, budgets } of await listPages()) {
    const url = `${ORIGIN}${path}`;
    const runs = [];
    for (let index = 0; index < RUNS; index += 1) {
      const result = await lighthouse(url, {
        port: chrome.port,
        output: 'html',
        logLevel: 'error',
        onlyCategories: CATEGORIES,
      });
      if (!result) {
        throw new Error('Lighthouse returned no result.');
      }
      runs.push({ ...summarize(result.lhr), report: result.report });
    }

    // Median run by performance score: its full report is saved (the home page as report.html)
    const ranked = [...runs].sort((a, b) => a.scores.performance - b.scores.performance);
    const medianRun = ranked[Math.floor(ranked.length / 2)];
    const reportName =
      path === '/' ? 'report' : `report${path.replace(/\/$/, '').replaceAll('/', '-')}`;
    await writeFile(`${REPORT_DIR}/${reportName}.html`, medianRun.report);

    const scores = Object.fromEntries(
      CATEGORIES.map((id) => [id, median(runs.map((run) => run.scores[id]))]),
    );
    const measured = {
      script: median(runs.map((run) => run.script)),
      stylesheet: median(runs.map((run) => run.stylesheet)),
      total: median(runs.map((run) => run.total)),
      foreignRequests: Math.max(...runs.map((run) => run.foreignRequests)),
    };

    const problems = [];
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push(`Lighthouse, mobile, median of ${String(RUNS)} runs, ${url}`, '');
    for (const id of CATEGORIES) {
      const score = Math.round(scores[id] * 100);
      const ok = scores[id] >= MIN_SCORE;
      lines.push(
        `${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(15)} ${String(score).padStart(3)}  (min ${String(MIN_SCORE * 100)})`,
      );
      if (!ok) {
        problems.push(`${id} score ${String(score)} is below ${String(MIN_SCORE * 100)}`);
      }
    }
    for (const [type, limit] of Object.entries(budgets)) {
      const value = measured[type];
      const ok = value <= limit;
      lines.push(
        `${ok ? 'PASS' : 'FAIL'}  ${`${type} transfer`.padEnd(15)} ${(value / 1024).toFixed(1).padStart(5)} KB  (max ${(limit / 1024).toFixed(0)} KB)`,
      );
      if (!ok) {
        problems.push(
          `${type} transfer ${(value / 1024).toFixed(1)} KB exceeds ${(limit / 1024).toFixed(0)} KB`,
        );
      }
    }
    const foreignOk = measured.foreignRequests === 0;
    lines.push(
      `${foreignOk ? 'PASS' : 'FAIL'}  ${'third-party'.padEnd(15)} ${String(measured.foreignRequests).padStart(5)}     (max 0 requests to other origins)`,
    );
    if (!foreignOk) {
      problems.push(`${String(measured.foreignRequests)} requests to other origins`);
    }

    summaries[path] = { scores, measured, failures: problems };
    failures.push(...problems.map((problem) => `${path}: ${problem}`));
  }

  log(lines.join('\n'));
  await writeFile(
    `${REPORT_DIR}/summary.json`,
    JSON.stringify({ pages: summaries, failures }, null, 2),
  );
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `### Lighthouse\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`,
    );
  }
  if (failures.length > 0) {
    log(`\nFailed: ${failures.join('; ')}`);
    exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  exitCode = 1;
} finally {
  if (chrome) {
    try {
      chrome.kill();
    } catch {
      // On Windows Chrome can still hold its temp files for a moment (EPERM when removing them).
      // That is only cleanup and must not change the result.
    }
  }
  server.kill();
}

// Exit explicitly, so a leftover handle can never keep the process (and the CI job) alive
process.exit(exitCode);
