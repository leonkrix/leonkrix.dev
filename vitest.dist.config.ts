import { existsSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

// Load the local, gitignored .env so the tests also check your real Impressum values locally.
// In CI and on Cloudflare the values come from the environment (or are unset: placeholders).
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Checks against the production build in dist/ (run after `pnpm build`)
export default defineConfig({
  test: {
    include: ['tests/build-output/**/*.test.ts'],
    environment: 'node',
  },
});
