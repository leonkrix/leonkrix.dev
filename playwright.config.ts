import { defineConfig, devices } from '@playwright/test';

// A different port than `astro dev` (4321), so both can run at the same time
const port = 4322;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // Never hang: stop the whole run after 8 minutes (a local run takes about 20 seconds)
  globalTimeout: isCI ? 8 * 60_000 : undefined,
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
  // Tests run against the production build, exactly what is deployed
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(port)}`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
