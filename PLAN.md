# Roadmap

Check items off as they are done. Each phase should end in a deployable state. CI must be green before anything is deployed (see CLAUDE.md, "CI/CD").

## Phase 0 - Foundation and tooling

- [x] Dev environment: Windows native (WebStorm) for now, Debian later; both must work
- [x] Install Node LTS and pnpm; add `.nvmrc`, `packageManager` field
- [x] Scaffold Astro (TypeScript strict) + React integration + Tailwind v4
- [x] `.gitattributes` (LF), `.editorconfig`, `.gitignore`
- [x] ESLint flat config: typescript-eslint strict (type-aware), astro, react, react-hooks, jsx-a11y, import sorting
- [x] Prettier + astro and tailwind plugins, `eslint-config-prettier`
- [x] `tsconfig` strictest; `astro check`
- [x] Scripts: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `check`
- [x] Husky + lint-staged pre-commit hooks (commitlint still undecided)
- [x] Vitest set up with a first test
- [x] Self-hosted fonts (Fontsource), design tokens (colors, fonts) in global CSS
- [x] Base layout, SEO component (meta, OG), favicon
- [x] `LICENSE` (All rights reserved, (c) 2026 Leon Krix), short `README.md`
- [x] `.env.example` (Impressum placeholders), `.env` gitignored
- [ ] Verify pre-commit hook runs on the first commit (from WebStorm)
- [ ] Commit and push Phase 0 to `main` (bootstrap: no branch protection yet)
- [ ] Typed env access in Astro (`astro:env`), done together with the Impressum page in Phase 2

Tooling notes:

- TypeScript is pinned to **6.x** (`typescript@6`). TS 7 is not yet supported by typescript-eslint and `astro check`. Renovate/Dependabot must ignore TS major 7 until both support it.
- ESLint is **10.x**. `eslint-plugin-react` crashes on ESLint 10 (`getFilename is not a function`), so React linting uses `@eslint-react/eslint-plugin` plus `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`. Do not re-add `eslint-plugin-react`.
- `pnpm peers check` still shows one known, harmless warning: `eslint-plugin-jsx-a11y` declares peer support only up to ESLint 9, but it works on 10 (verified with test files).

## Phase 1 - CI and first deploy

- [ ] `.github/workflows/ci.yml`: install (frozen lockfile), lint, format check, typecheck, test, build
- [ ] Workflow hygiene: minimal `permissions`, actions pinned to SHA, concurrency, pnpm cache
- [ ] Renovate or Dependabot (npm + GitHub Actions)
- [ ] Branch protection on `main`: PR required, required status checks, up to date, no force push
- [ ] Cloudflare project via Git integration (`main` -> production, PRs -> preview; build `pnpm build`, output `dist`). No API token needed
- [ ] Deploy the placeholder page through this pipeline
- [ ] Domain: switch DNS (copy IONOS MX records first!), attach `leonkrix.dev`, `www` redirect
- [ ] Add Impressum build variables in Cloudflare (and local `.env`); never commit them
- [ ] Verify HTTPS, set up `inquiries@leonkrix.dev` mailbox
- [ ] Verify the gate: a PR with a failing check must not be mergeable or deployable

## Phase 2 - MVP content

- [ ] Header with anchor navigation + scroll-spy, footer
- [ ] Hero (Leon Krix, Software Engineer, CTA)
- [ ] About section
- [ ] Content collections: `projects` (public/private), `experience` (education/work/other)
- [ ] Featured projects section
- [ ] Experience timeline + CV PDF download
- [ ] Contact section (mailto, GitHub, LinkedIn)
- [ ] `/impressum` and `/datenschutz` (placeholders first, then real texts)
- [ ] `robots.txt`, `sitemap.xml`, JSON-LD
- [ ] `/404`

## Phase 3 - Design polish and quality gates

- [ ] Animated background (grain / glow / grid), cursor glow
- [ ] Scroll reveals, hero text animation, View Transitions
- [ ] Reduced-motion handling, accessibility pass (keyboard, contrast, focus)
- [ ] OG image
- [ ] Playwright smoke/e2e tests added to CI
- [ ] Lighthouse CI added to CI with score assertions (95+ mobile)
- [ ] `pnpm audit` (and optionally CodeQL) added to CI

## Phase 4 - Games

- [ ] `/games` overview + shared game shell (language toggle DE/EN, localStorage stats)
- [ ] Wordle (DE/EN word lists, license check, daily word from date, Vitest for logic)
- [ ] Further small games (pick from: 2048, Minesweeper, Snake, typing test, guess-the-language)
- [ ] Clueless (embedding pipeline, precomputed daily rankings)
- [ ] `THIRD_PARTY.md` with licenses of word lists and assets

## Phase 5 - Extras

- [ ] Command palette (Cmd/Ctrl+K)
- [ ] Terminal easter egg
- [ ] `/uses` page, optional blog (MDX)
- [ ] Periodic legal review

## Open decisions

- Impressum address: private address vs. paid Impressum service
- Cloudflare Pages vs. Workers Static Assets (check at setup)
- Final palette tuning (see CLAUDE.md tokens)
- Real content: projects, CV, About text
- Commitlint yes/no
