import { defineConfig, devices } from '@playwright/test';

// The ports: `astro dev` is 4321 (WebStorm or Claude, only one of them at a time), the browser tests
// start their own `astro preview` on 4322, Lighthouse uses 4323. A server that already stands on
// 4322 is never reused (with `astro dev` there the tests ran against the dev server, with its
// toolbar in front of every click and no CSP): the run stops with "port already used" instead.
const port = 4322;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // Never hang: stop the whole run after 15 minutes. The suite has about 700 tests: a local run on
  // eight workers takes about 3 minutes, the runner of the CI (four cores) about 6. The limit was
  // 8 minutes and was reached with 527 of 704 tests done (2026-10-16), when the suite had grown
  // with the palette, the radar and the tests of the fonts: raise it when the run takes more than
  // two thirds of it, and keep an eye on the slow tests (the radar and the fonts wait on purpose).
  ...(isCI ? { globalTimeout: 15 * 60_000 } : {}),
  // Playwright starts one worker per two cores by default, which is two on the runner of the CI and
  // made the run slow; the tests wait for the browser more than they compute, so one per core is fine
  ...(isCI ? { workers: 4 } : {}),
  retries: isCI ? 1 : 0,
  // `list` prints every test as it finishes, so a stuck run is visible in the CI log
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'on-first-retry',
    // Fail fast instead of waiting minutes when the browser cannot start
    launchOptions: { timeout: 60_000 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Tests run against the production build, exactly what is deployed. The build happens first
  // (see the test:e2e script). The server is a single process, without pnpm or shell wrappers
  // around it, so Playwright can always stop it (wrappers left the CI run hanging at the end).
  webServer: {
    command: `node node_modules/astro/bin/astro.mjs preview --port ${String(port)}`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
