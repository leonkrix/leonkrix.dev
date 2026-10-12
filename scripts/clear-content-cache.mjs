/**
 * Deletes the saved content of the content collections (the YAML files of projects and
 * experience, parsed) before the dev server or a build starts.
 *
 * Why: Astro saves every parsed entry with a digest of its file. When only the schema changes
 * (`src/lib/projects.ts`, a new field), the digest of the file stays the same, so the old entry is
 * reused and the new field is missing. Worse, a running dev server writes entries that it parsed
 * with the schema it had loaded when it started, and a restart keeps using them. Parsing five
 * small files again takes milliseconds, so this is done every time instead of hunting for a
 * stale entry. Used by `pnpm dev`, `pnpm build` and `scripts/build-with-form.mjs`.
 */
import { rmSync } from 'node:fs';

for (const file of ['.astro/data-store.json', 'node_modules/.astro/data-store.json']) {
  rmSync(file, { force: true });
}
