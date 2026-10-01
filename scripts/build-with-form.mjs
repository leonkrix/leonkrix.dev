/**
 * Builds the site with the contact form switched on (PUBLIC_CONTACT_FORM=true). The browser tests
 * and Lighthouse use this build, because they have to see the form. The plain `pnpm build` is what
 * production gets until the form is switched on there (Cloudflare build variable of the same name).
 * A small script instead of `VAR=value command`, so it works on Windows and Linux alike.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_CONTACT_FORM: 'true' },
});
process.exit(result.status ?? 1);
