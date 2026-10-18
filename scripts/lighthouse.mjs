/**
 * Quality gate: runs Lighthouse (mobile preset, simulated slow 4G and CPU throttling) against the
 * production build served by `astro preview`, three times, and takes the median.
 * Fails when a category score is below its threshold or a budget is exceeded.
 *
 * Usage: pnpm lighthouse   (builds first)
 *        pnpm lighthouse --shard 2/3   (only the second of three parts of the pages; the CI runs the three parts as three jobs)
 *        pnpm lighthouse --page /uses/ --page /notes/   (only these pages, for a quick look while building)
 * Needs a Chrome or Chromium; set CHROME_PATH if it is not found automatically.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, writeFile } from 'node:fs/promises';

import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

import { takeShard } from './shard.mjs';

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
 * The stylesheet limit was raised from 20 to 21 KB on 2026-10-18: the home page carries the pictures of
 * the tiles of all five games (the Backbone tile came last), it measured 20.2 KB with a smaller tile.
 */
const BUDGETS = {
  script: 10 * 1024,
  stylesheet: 21 * 1024,
  total: 200 * 1024,
};

/**
 * Budgets of the game pages by slug (src/games/<slug>), in bytes. A live game must have an entry
 * here: set it deliberately from a measurement (React and the game's own script are the big part).
 * Without an entry the run fails, so a game cannot go live without a budget.
 */
const GAME_BUDGETS = {
  // Measured on 2026-10-09 (React, the game, the five-letter list): scripts 96 KB, stylesheets 12.8 KB, total 203 KB
  // The stylesheet is shared by the Playground pages and holds the CSS of every game (21.6 KB on 2026-10-13 with four games; the styles are imported once, by the page of each game, not by the picture of the game and the game itself), so every game page has the same stylesheet limit: a new game adds about 3 KB
  'tech-words': { script: 130 * 1024, stylesheet: 24 * 1024, total: 260 * 1024 },
  // Measured on 2026-10-10 (React, the game, the 18 levels, the generator is a separate worker file that is only loaded for a random level): scripts 100 KB, stylesheets 17.7 KB, total 212 KB
  'root-cause': { script: 130 * 1024, stylesheet: 24 * 1024, total: 260 * 1024 },
  // Measured on 2026-10-12 (React, the game, about 240 categories: the data is split into 14 files and only the files of the four categories of a puzzle are fetched, usually three or four): scripts 111 KB, stylesheets 21.1 KB, total 227 KB
  'link-up': { script: 130 * 1024, stylesheet: 24 * 1024, total: 260 * 1024 },
  // Measured on 2026-10-13 (React, the game, and the word data of about 2 MB that is fetched when the page opens: 1.9 MB of vectors, 0.27 MB of words): scripts 78 KB, stylesheets 24.2 KB, total 2196 KB; performance 98
  'word-radar': { script: 130 * 1024, stylesheet: 24 * 1024, total: 2600 * 1024 },
  // Measured on 2026-10-18 (React, the game and the overview of the campaign, made from a small catalog; the level pool (about 330 KB, fetched when a level is opened) and the generator of random levels are separate files that are not part of the first load): scripts 109 KB, stylesheets 25.9 KB, total 238 KB; performance 96
  backbone: { script: 130 * 1024, stylesheet: 28 * 1024, total: 300 * 1024 },
};

/** The pages to test: the home page, the Playground pages once a game is live, and the notes. */
async function listPages() {
  const pages = [{ path: '/', budgets: BUDGETS }];
  if (existsSync('dist/games/index.html')) {
    // The overview loads the shared Playground stylesheet (2026-10-13: 21.6 KB, all games in one file;
    // 2026-10-18: 26.4 KB with five games, so the limit is the one of the Backbone page)
    pages.push({ path: '/games/', budgets: { ...BUDGETS, stylesheet: 28 * 1024 } });
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
  // The Uses page is a plain page with the normal budgets
  if (existsSync('dist/uses/index.html')) {
    pages.push({ path: '/uses/', budgets: BUDGETS });
  }
  // The notes (Behind the scenes): the overview and every note, plain text pages with the normal budgets
  if (existsSync('dist/notes/index.html')) {
    pages.push({ path: '/notes/', budgets: BUDGETS });
    const folders = await readdir('dist/notes', { withFileTypes: true });
    for (const folder of folders.filter((entry) => entry.isDirectory())) {
      pages.push({ path: `/notes/${folder.name}/`, budgets: BUDGETS });
    }
  }
  // --page <path> (repeatable) tests only those pages. A full run takes about five minutes.
  const only = process.argv.flatMap((arg, index) =>
    arg === '--page' && process.argv[index + 1] !== undefined ? [process.argv[index + 1]] : [],
  );
  const unknown = only.filter((path) => !pages.some((page) => page.path === path));
  if (unknown.length > 0) {
    throw new Error(`Unknown page(s) for --page: ${unknown.join(', ')}`);
  }
  const chosen = only.length === 0 ? pages : pages.filter((page) => only.includes(page.path));
  // --shard 2/3 tests only the second of three parts of the pages (every page is in exactly one part,
  // see shard.mjs). The CI runs the parts as separate jobs on separate machines, which is a third of
  // the time and does not change a single measurement: a run is still alone on its machine.
  const shardFlag = process.argv.indexOf('--shard');
  return shardFlag < 0 ? chosen : takeShard(chosen, process.argv[shardFlag + 1]);
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
