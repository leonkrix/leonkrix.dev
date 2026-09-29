import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';

const legalEnvKeys = ['IMPRESSUM_STREET', 'IMPRESSUM_ZIP', 'IMPRESSUM_CITY'];

// Cloudflare sets the branch during its builds. A production build without the Impressum
// address must fail instead of publishing placeholders.
const isProductionBuild =
  process.env.CF_PAGES_BRANCH === 'main' || process.env.WORKERS_CI_BRANCH === 'main';

if (isProductionBuild) {
  const missing = legalEnvKeys.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Production build is missing required Impressum variables: ${missing.join(', ')}. ` +
        'Set them in the Cloudflare project (Settings > Variables and Secrets).',
    );
  }
}

// https://astro.build/config
export default defineConfig({
  site: 'https://leonkrix.dev',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      IMPRESSUM_STREET: envField.string({ context: 'server', access: 'secret', optional: true }),
      IMPRESSUM_ZIP: envField.string({ context: 'server', access: 'secret', optional: true }),
      IMPRESSUM_CITY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
