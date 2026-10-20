import { defineConfig } from 'vitest/config';

// Only for `pnpm levels-backbone`: like the Root Cause generator, it runs as a "test" because
// vitest resolves our TypeScript imports without file extensions, which plain Node cannot.
export default defineConfig({
  test: {
    include: ['scripts/generate-backbone-levels.gen.ts'],
    environment: 'node',
    testTimeout: 0,
    hookTimeout: 0,
  },
});
