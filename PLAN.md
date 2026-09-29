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
- [x] Verify pre-commit hook runs on the first commit (from WebStorm)
- [x] Commit and push Phase 0 to `main` (bootstrap: no branch protection yet)
- [x] Typed env access in Astro (`astro:env`) for the Impressum variables (done with the legal pages)

Tooling notes:

- TypeScript is pinned to **6.x** (`typescript@6`). TS 7 is not yet supported by typescript-eslint and `astro check`. Renovate/Dependabot must ignore TS major 7 until both support it.
- ESLint is **10.x**. `eslint-plugin-react` crashes on ESLint 10 (`getFilename is not a function`), so React linting uses `@eslint-react/eslint-plugin` plus `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`. Do not re-add `eslint-plugin-react`.
- `pnpm peers check` still shows one known, harmless warning: `eslint-plugin-jsx-a11y` declares peer support only up to ESLint 9, but it works on 10 (verified with test files).

## Phase 1 - CI and first deploy

- [x] `.github/workflows/ci.yml`: parallel jobs `quality`, `test`, `build` plus aggregate gate `ci-ok`; reusable setup action. First run green
- [x] Workflow hygiene: minimal `permissions`, actions pinned to SHA, concurrency, pnpm cache
- [x] Dependabot (npm + GitHub Actions), grouped weekly, ignoring TypeScript 7 and ESLint 11 majors
- [x] Repo settings: squash merge only, auto-delete head branches, secret scanning + push protection
- [x] Ruleset `protect-main`: PR required, required check **`CI passed`**, up to date, no force push, no deletion
- [x] Cloudflare project via Git integration; placeholder page deployed
- [x] Domain: DNS moved to Cloudflare (mail records kept), `leonkrix.dev` and `www` attached, `www` redirects to apex, HTTPS works
- [x] Cost check: Cloudflare Free, GitHub Free (public repo), no payment method
- [x] **PR 1 (`docs/record-decisions`)**: this docs update, the first PR through the whole flow (PR, CI, Cloudflare preview, squash merge, production deploy)
- [x] Verify the gate: open a throwaway PR that fails CI (e.g. a lint error) and confirm it cannot be merged; then close it without merging
- [ ] Add the Impressum build variables in Cloudflare, Production only (`IMPRESSUM_STREET`, `IMPRESSUM_ZIP`, `IMPRESSUM_CITY`); never commit them. The production build now fails if they are missing
- [ ] Set up the `hello@leonkrix.dev` mailbox at IONOS and send/receive a test mail (check SPF/DKIM/DMARC pass)
- [ ] Cloudflare security settings: Bot Fight Mode, AI bot blocking, email address obfuscation; DNSSEC (optional)

## Phase 1b - Security and CI extras (one branch per item, all via PR)

- [ ] `actionlint` job in CI (lint the workflow files), added to `needs` of `ci-ok`
- [ ] `dependency-review` job on pull requests, added to `needs` of `ci-ok`
- [ ] `.github/workflows/codeql.yml` (`javascript-typescript`; PRs, `main`, weekly), pinned actions
- [ ] `SECURITY.md` and private vulnerability reporting enabled
- [ ] Optionally: PR title check (Conventional Commit format, since PR titles become squash commits)
- [ ] Later (Phase 3): OpenSSF Scorecard workflow and badge

## Phase 2 - MVP content

Start with the legal pages (the site is already live): they come before design and content.

- [x] Typed env access (`astro:env`) for the Impressum variables, placeholders when unset, production build fails when missing
- [x] Shared obfuscated-contact component (CSS-rendered address/phone, assembled email, works without JS); used by Impressum and Datenschutz
- [x] `/impressum` and `/datenschutz` drafted in German with English notice, `noindex`, linked in the footer of every page
- [ ] Review the legal texts against a generator (eRecht24 / IT-Recht Kanzlei) and adjust; add the state supervisory authority if desired
- [x] Test: address, placeholders and email are not present as plain text in `dist/`; no mailto link in the HTML (CI job `build` runs `pnpm test:dist`)
- [ ] Header with anchor navigation + scroll-spy, footer
- [ ] Hero (Leon Krix, Software Engineer, CTA)
- [ ] About section
- [ ] Content collections: `projects` (public/private), `experience` (education/work/other)
- [ ] Featured projects section
- [ ] Experience timeline + CV PDF download
- [ ] Contact section (mailto, GitHub, LinkedIn)
- [ ] `robots.txt` (with AI crawler disallows), `sitemap.xml`, JSON-LD
- [ ] `/404`
- [ ] Zod schemas for content collections (private projects must not carry a repo link)
- [ ] CI job `site-checks`: Vitest over `dist/` (title/description/canonical/lang on every page, Impressum and Datenschutz present and linked, robots/sitemap, no broken internal links, no `http://` resources, no leftover Impressum placeholders in production)

## Phase 3 - Design polish and quality gates

- [ ] Animated background (grain / glow / grid), cursor glow
- [ ] Scroll reveals, hero text animation, View Transitions
- [ ] Reduced-motion handling, accessibility pass (keyboard, contrast, focus)
- [ ] OG image
- [ ] CI job `e2e`: Playwright smoke tests (anchors, mobile viewport, keyboard, reduced motion, no console errors)
- [ ] Privacy guard test: only same-origin requests, no cookies set
- [ ] Accessibility: `@axe-core/playwright` scan of every page, fail on violations
- [ ] CI job `lighthouse`: Lighthouse CI with budgets (95+ mobile) and a JS bundle size budget
- [ ] CI job `security`: `pnpm audit` (high); OpenSSF Scorecard
- [ ] Add the new jobs to `needs` of `ci-ok` (no branch protection change needed)

## Phase 4 - Games

- [ ] `/games` overview + shared game shell (language toggle DE/EN, localStorage stats)
- [ ] Wordle (DE/EN word lists, license check, daily word from date, Vitest for logic)
- [ ] Further small games (pick from: 2048, Minesweeper, Snake, typing test, guess-the-language)
- [ ] Clueless (embedding pipeline, precomputed daily rankings)
- [ ] `THIRD_PARTY.md` with licenses of word lists and assets

## Phase 5 - Extras

- [ ] Command palette (Cmd/Ctrl+K)
- [ ] Terminal easter egg
- [ ] Contact form (optional, second contact channel): Cloudflare Worker/Pages Function + email sending service + Turnstile spam protection, secrets as Cloudflare secrets, update the privacy policy (data processing, processor agreement)
- [ ] `/uses` page, optional blog (MDX)
- [ ] Periodic legal review

## Open decisions

- Decided: private address in the Impressum (obfuscated), Cloudflare Git integration, CodeQL yes, SonarQube Cloud no
- Final palette tuning (see CLAUDE.md tokens)
- Real content: projects, CV, About text
- Commitlint yes/no (PR title check is the lighter alternative because of squash merges)
- Lower-priority Phase 0 leftover: none
