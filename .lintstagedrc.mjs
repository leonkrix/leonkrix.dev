// Runs on every commit, on the staged files only. The tasks run one after another
// (see .husky/pre-commit), because the type check must not run while `eslint --fix` edits files.
export default {
  // 1. Fix and format the staged files
  '*.{js,mjs,cjs,ts,tsx,astro}': ['eslint --fix', 'prettier --write'],
  '*.{css,json,md,mdx,yml,yaml,html}': ['prettier --write'],

  // 2. Whole-project checks. They cannot run per file (a type change in one file affects others),
  // so they run once, and only when code was staged. Documentation-only commits stay instant.
  '*.{ts,tsx,astro}': () => 'pnpm typecheck',

  // 3. Unit tests of the changed modules only
  '*.{ts,tsx}': ['vitest related --run --passWithNoTests'],
};
