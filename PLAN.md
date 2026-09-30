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
- [x] Add the Impressum build variables in Cloudflare, Production only (`IMPRESSUM_STREET`, `IMPRESSUM_ZIP`, `IMPRESSUM_CITY`); never commit them. The production build now fails if they are missing
- [x] `hello@leonkrix.dev` mailbox at IONOS works (send and receive tested)
- [x] Cloudflare security baseline (Full strict, Always HTTPS, min TLS 1.2, Bot Fight Mode, AI bot blocking; Web Analytics and Rocket Loader stay off). DNSSEC deliberately skipped (small benefit, outage risk); HSTS is sent via `public/_headers`

## Phase 1b - Security and CI extras (one branch per item, all via PR)

- [x] `actionlint` job in CI (lint the workflow files), added to `needs` of `ci-ok`
- [x] `dependency-review` job on pull requests, added to `needs` of `ci-ok`
- [x] Security headers in `public/_headers` plus a strict CSP via Astro (`security.csp`), covered by `tests/build-output/security.test.ts`
- [x] Live headers checked: securityheaders.com grade A (A+ expected with HSTS from the wrap-up PR)
- [x] `.github/workflows/codeql.yml` (`javascript-typescript`; PRs, `main`, weekly), pinned actions
- [x] `SECURITY.md` (private vulnerability reporting must be enabled in the GitHub repo settings)
- [ ] Optionally: PR title check (Conventional Commit format, since PR titles become squash commits)
- [ ] Later (Phase 3): OpenSSF Scorecard workflow and badge

## Phase 2 - MVP content

Legal pages first (the site was already live), then the page content in small PRs.

- [x] Typed env access (`astro:env`) for the Impressum variables, placeholders when unset, production build fails when missing
- [x] Shared obfuscated-contact component (CSS-rendered address/phone, assembled email, works without JS); used by Impressum and Datenschutz
- [x] `/impressum` and `/datenschutz` drafted in German with English notice, `noindex`, linked in the footer of every page
- [x] Test: address, placeholders and email are not present as plain text in `dist/`; no mailto link in the HTML (CI job `build` runs `pnpm test:dist`)
- [ ] Review the legal texts against a generator (eRecht24 / IT-Recht Kanzlei) and adjust; add the state supervisory authority if desired

Content PRs (one branch each):

- [x] PR 1 Layout: wordmark logo, sticky header with anchor navigation, scroll-spy and JS-free mobile menu, section scaffold, skip link, header tests
- [x] PR 2 Icons, hero and About: `Icon.astro` (lucide + simple-icons), hero with calls to action, About with technology groups
- [x] PR 3 Content collection `projects` (Zod) and the projects timeline: this website, Defuze, Master thesis, Bachelor thesis, Grade & Study Tracker; fields `kind`, `institution`, `grade`, `stats`, `code` (public, planned, none), technologies from the registry
- [x] PR 4 Content collection `experience` (Zod), Experience section (Education and Work as a compact list with icons, coursework, link to the related thesis) and the "Open to opportunities" availability badge in the hero
- [x] PR 5 Contact section (email, GitHub, LinkedIn, availability text), `robots.txt` (AI training crawlers blocked), dependency-free `sitemap.xml` (noindex pages excluded), JSON-LD `Person` (no email or address), `/404` in terminal style, and build checks for broken internal links and anchors

Content decisions (done): no CV download, no certificates, no school (Abitur), no final degree grades (thesis grades 1.0 are shown on the project cards), no non-dev jobs, no Impressum-relevant private data.

Open content follow-ups:

- [ ] Refine the About text together with Leon after the first live version
- [ ] Optional: concrete evaluation numbers for the Bachelor thesis as key figures
- [ ] When the thesis repositories are public: switch `code` from `planned` to `public` (with URL) in the two thesis files
- [ ] Update the availability badge (`availability` in `src/lib/site.ts`) when Leon is no longer looking

Phase 2 is complete once PR 5 is merged. What remains before the first "real" version is small content polish (see the open follow-ups above) and Phase 3.

## Phase 3 - Quality gates, contact form, design polish

Order (decided): 3A quality gates first, then 3B the contact form (so its browser tests have the infrastructure), then 3C design polish and animations.

### 3A Quality gates

- [x] CI job `e2e` (part of `CI passed`): Playwright against the production build on desktop and mobile; smoke tests for navigation, mobile menu, skip link, email link, external links, legal pages, 404, no horizontal scrolling, reduced motion; every test also fails on console errors, CSP violations and HTTP errors
- [x] Privacy guard test (Playwright): only same-origin requests and no cookies on every page, including the 404 page (Cloudflare's `__cf_bm` only appears in production with bot protection; if it ever shows up in a test, allow exactly that cookie)
- [x] Accessibility: `@axe-core/playwright` scan of every page against WCAG 2.2 AA and best practices, currently no violations
- [ ] CI job `lighthouse`: Lighthouse CI with budgets (95+ mobile) and a JS bundle size budget
- [ ] CI job `security`: `pnpm audit` (high); OpenSSF Scorecard
- [ ] Add the new jobs to `needs` of `ci-ok` (no branch protection change needed)
- [ ] Keep the portfolio in sync: Playwright and axe are in the registry and the website project (done); still to add: Lighthouse CI, and a verifiable Lighthouse score as a key figure of the website project

- [x] Stronger pre-commit hook: project-wide type check and related unit tests when code is staged (a type error slipped past the old hook to CI once); build warnings about Shiki and the CSP style directive removed (`markdown.syntaxHighlight: false`, style elements scoped with `kind: element`)
- [ ] Improve the README (small docs PR after Lighthouse): short description, link to the live site, a few badges (GitHub Actions status for `ci.yml` and `codeql.yml`, OpenSSF Scorecard once it exists, "all rights reserved"), the script table. Badges belong in the README only: embedding badge images on the website would be third-party requests (privacy guard, CSP)
- [x] The e2e job no longer hangs after the tests on GitHub (first runs hung inside `pnpm test:e2e` before the summary was printed, most likely while stopping the web server). Fixes: the server is a single process (`astro preview` directly), the build runs before Playwright, `gracefulShutdown`, an 8 minute global timeout, an 8 minute step timeout and the list reporter. Verified green. Plan B if it returns: start the preview server in the workflow as a background process with its output redirected to a file

### 3B Contact form (decided: yes, free, with JavaScript)

Decisions: fields name, email and message; requires JavaScript (progressive enhancement is not worth the extra surface); without JavaScript the section shows the obfuscated email instead. The Contact section becomes: short text, the form as the main element, and a uniform row of icon buttons (Email, GitHub, LinkedIn); the large email card goes away. Terminal or calm card styling that matches the site, with clear states (empty, error, sending, sent).

- [ ] Spike on a throwaway branch: a Cloudflare Pages Function that sends one test mail through the existing **IONOS mailbox via SMTP** (Workers TCP sockets, port 587 or 465). Goals: no new email processor, SPF/DKIM already aligned. Needs from Leon: SMTP host and port (from the Outlook settings) and whether the IONOS plan allows a second mailbox (preferred: a dedicated sender mailbox such as `contact@`, credentials only as Cloudflare secret). Unknowns to verify: IONOS accepts connections from Cloudflare, the Free plan CPU limit is enough
- [ ] Fallback if the spike fails: Cloudflare Email Sending (about 5 USD per month, Workers Paid, Beta, needs DNS onboarding and a solution for the `_dmarc` CNAME to IONOS) or Brevo or Resend (free tier), all behind the same small mailer interface; sender on a subdomain so IONOS MX stays untouched; needs a processor agreement and a privacy policy update
- [ ] Shared validation rules (one module used by browser and server): name 2-80 characters, email valid and at most 254, message 20-2000, no control characters, honeypot empty; unit tests with boundary cases (just below, exactly on, just above), whitespace only, emoji, newlines, injection attempts
- [ ] `POST /api/contact` Pages Function: method, content type, body size limit (10 KB), Origin check (own site only), no CORS, server-side validation, honeypot, HMAC-signed timing token (not too fast, not expired), rate limiting per sender, fixed recipient and sender (no open relay), header injection prevention, Reply-To from the visitor, no message content in logs, generic error messages
- [ ] Function tests (Vitest with a mocked mailer): wrong method, invalid JSON, oversized body, honeypot, too fast and expired token, foreign Origin, mailer failure without leaking details, success
- [ ] Contact form UI (Astro + small script, native validation attributes plus the shared rules, accessible error messages, keyboard friendly), CSP unchanged (`connect-src 'self'`, `form-action 'self'`)
- [ ] Playwright and axe tests for the form (validation messages, success and error states, keyboard, no console errors)
- [ ] Update the privacy policy: contact form, data, purpose, legal basis, processors (Cloudflare, IONOS or the fallback provider), retention, no storage beyond forwarding; short notice next to the form; update the "no third parties" wording if a provider is added
- [ ] Add the Function tests to CI (`ci-ok`), add secrets to Cloudflare (production only), document local development with `wrangler pages dev` and `.dev.vars` (gitignored)
- [ ] Optional later: Cloudflare Turnstile only if spam appears (needs a CSP change and a privacy policy update)

### 3C Design polish and animations

- [ ] Animated background: fine grid with a soft glow that follows the cursor (decided), disabled for reduced motion
- [ ] Richer animation for the availability badge (a CSS pulse exists already)
- [ ] Optional highlight: a small horizontal timeline strip (2018 to 2026) that shows B.Sc., the teaching assistant job and the M.Sc. overlapping, animated on scroll; the list stays as the mobile fallback
- [ ] Scroll reveals, hero text animation, page transitions with the native CSS View Transition API (`@view-transition`), NOT Astro's `<ClientRouter />` (not supported with the CSP)
- [ ] Reduced-motion handling, accessibility pass (keyboard, contrast, focus)
- [ ] OG image (dark background, wordmark, "Leon Krix, Software Engineer"), generated at build time

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

- Decided: private address in the Impressum (obfuscated), Cloudflare Git integration, CodeQL yes, SonarQube Cloud no, availability badge "Open to opportunities" (no start date), experience as a compact list unlike the projects timeline
- Final palette tuning (see CLAUDE.md tokens; status green `#34d399` was added for the availability dot)
- Commitlint yes/no (PR title check is the lighter alternative because of squash merges)
