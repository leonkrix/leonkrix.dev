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
- [x] CI job `lighthouse` (part of `CI passed`): `scripts/lighthouse.mjs` runs Lighthouse (mobile, simulated throttling) three times against the production build and takes the median; every category must reach 95 (measured on 2026-09-30: performance 99, accessibility 100, best practices 100, SEO 100), budgets for transferred bytes (scripts 10 KB, stylesheets 20 KB, total 200 KB; measured 1.5, 6.8 and 129 KB) and no request to another origin. The report is uploaded as an artifact. We use Lighthouse directly (13.x) and not `@lhci/cli`, which is barely maintained and would pull old dependencies into `pnpm audit`
- [x] CI job `audit` (part of `CI passed`): `pnpm audit --audit-level high` on every pull request and push (currently no known vulnerabilities); the same audit also runs weekly in `security.yml`. OpenSSF Scorecard runs in `.github/workflows/security.yml` (push to `main`, weekly, on branch protection changes) with published results and SARIF upload to the Security tab
- [x] First Scorecard run: 6.7 of 10. Everything we can influence is 10 (dangerous workflows, token permissions, vulnerabilities, update tool, security policy, pinned dependencies, binaries, CI tests). Expected to rise by itself: Maintained (needs a repository age of 90 days) and SAST (older commits leave the window). Not applicable and intentionally left: Code-Review (GitHub does not let authors approve their own pull requests, so a required approval would block every merge in a solo project), Branch-Protection (partly needs approvals), Fuzzing, CII Best Practices (needs an open source license), Contributors, Packaging, Signed-Releases. Dismiss the not-applicable code scanning alerts as "Won't fix" with a reason
- [x] The new jobs (e2e, lighthouse, audit) are in `needs` of `ci-ok`; no branch protection change was needed
- [x] Keep the portfolio in sync: Playwright, axe and Lighthouse are in the registry and the website project; the key figure "95+ Lighthouse in every category (enforced in CI)" is on the website card

- [x] Stronger pre-commit hook: project-wide type check and related unit tests when code is staged (a type error slipped past the old hook to CI once); build warnings about Shiki and the CSP style directive removed (`markdown.syntaxHighlight: false`, style elements scoped with `kind: element`)
- [x] README rewritten: badges (CI, CodeQL, OpenSSF Scorecard, live site, license), quality gates table, scripts, project structure. Badges live in the README only, on the website they would be third-party requests. Keep it in sync when jobs or scripts are added (the Scorecard badge always shows the current score). A PR template with a self-check list was considered and rejected: solo project, a checklist only its author reads adds ceremony
- [x] The e2e job no longer hangs after the tests on GitHub (first runs hung inside `pnpm test:e2e` before the summary was printed, most likely while stopping the web server). Fixes: the server is a single process (`astro preview` directly), the build runs before Playwright, `gracefulShutdown`, an 8 minute global timeout, an 8 minute step timeout and the list reporter. Verified green. Plan B if it returns: start the preview server in the workflow as a background process with its output redirected to a file

### 3B Contact form (decided: yes, free, with JavaScript)

Decisions: fields name, email and message; requires JavaScript (progressive enhancement is not worth the extra surface); without JavaScript the section shows the obfuscated email instead. The Contact section becomes: short text, the form as the main element, and a uniform row of icon buttons (Email, GitHub, LinkedIn); the large email card goes away. Terminal or calm card styling that matches the site, with clear states (empty, error, sending, sent).

- [ ] Spike on a throwaway branch: a Cloudflare Pages Function that sends one test mail through the existing **IONOS mailbox via SMTP** (Workers TCP sockets, port 587 or 465). Goals: no new email processor, SPF/DKIM already aligned. Decided: the IONOS plan has exactly one mailbox, so `hello@leonkrix.dev` is both sender and recipient (Reply-To is the visitor). Needs from Leon: SMTP host and port (Outlook settings). Secrets: the mailbox password is stored as a Cloudflare **Secret** (runtime, encrypted; NOT a build variable, the Function cannot read those), locally in `.dev.vars` (gitignored, read by Wrangler). The password gives access to the whole mailbox: use a long unique one, never log or echo it, rotate it at IONOS and in Cloudflare if it may have leaked. Unknowns to verify: IONOS accepts connections from Cloudflare, the Free plan CPU limit is enough
- [x] Spike DONE, it works: SMTP through smtp.ionos.de:587 (STARTTLS, auth plain) with `worker-mailer`, locally (about 470 ms) and on a real Cloudflare preview deployment (about 420 ms, real Cloudflare colo), mail arrives in `hello@`. So IONOS accepts connections from Cloudflare and the Free plan CPU limit is enough. **Decision: the contact form uses the IONOS mailbox via SMTP, no third party.** Facts: Cloudflare **Pages** project `leonkrix-dev`; Functions in `functions/`, compatibility flag `nodejs_compat` (command line and dashboard, see the lesson below), non-secret mail settings as constants in `functions/_lib/config.ts`; secrets are per environment (production and preview are separate): set preview secrets with `wrangler pages secret put NAME --project-name leonkrix-dev --env preview` (value typed hidden), a new deployment is needed afterwards; preview deployments have no Impressum variables on purpose; `.dev.vars` is protected from Claude Code by a Read deny rule in the personal, untracked `.claude/settings.json` (content in CLAUDE.md, "Secrets and Claude Code")
- [x] Lesson from merging the foundation PR: the production build FAILED (the live site stayed on the last good deployment) because a `wrangler.jsonc` in the repository makes Cloudflare Pages ignore the dashboard variables at build time, including `IMPRESSUM_*`. Fixed by removing the file: the mail settings are constants in `functions/_lib/config.ts`, only `SMTP_PASSWORD` is a secret, compatibility flags go on the command line (scripts) and into the dashboard, and a guard test forbids any Wrangler config file in the repository
- [x] Fallback (Cloudflare Email Sending about 5 USD per month, or Brevo or Resend) is not needed; keep the mailer behind the small `sendMail` interface in `functions/_lib/smtp-mailer.ts` so it could be swapped
- [x] Foundation PR (branch `feat/contact-form-foundation`): spike endpoint removed, placeholder `POST /api/contact` (503 "not available yet") so `functions/` is valid and deployable, `functions/_lib/smtp-mailer.ts` with unit tests (mocked transport, config validation, always closes the connection), `pnpm typecheck` covers the Functions, Vitest runs `functions/**/*.test.ts`, CI job `build` runs `pnpm build:functions`, `pnpm dev:functions` for local runs, docs
- [ ] Dashboard setting by Leon (before the endpoint PR is deployed): in the Cloudflare project add the compatibility flag `nodejs_compat` and the compatibility date 2026-09-29 for Production and Preview (Leon set it, Cloudflare caps the date at the newest runtime)
- [ ] Spike cleanup by Leon: the `SPIKE_TOKEN` secret is already deleted. Still open: remove the old preview deployments of the spike branch in the dashboard and delete the branch `spike/ionos-smtp`
- [x] Shared validation rules in `src/lib/contact.ts` (plain TypeScript, no dependencies, no DOM or Workers types; used by the browser and the Function) with 140 unit tests: name 2-80 characters, at least one letter or digit, line breaks and tabs become spaces, NFC; email ASCII only, at most 254 and 64 before the @, procedural check in linear time (no regex backtracking), header injection attempts rejected; message 20-2000 characters counted as people see them (emoji = 1), trimmed, CRLF to LF, control characters and bidi spoofing characters rejected, joiners for emoji allowed; honeypot field `website`; errors have a code and a text for the visitor, all problems are reported at once. A repository guard test forbids hidden bidirectional or control characters in source files ("Trojan Source")
- [x] Endpoint PR (branch `feat/contact-form-endpoint`): `POST /api/contact` and `GET /api/contact-token`, logic in `functions/_lib/contact-handler.ts`, fully unit tested with a mocked mailer and an in-memory KV. Checks in this order: method (405), Origin must equal the own origin plus `Sec-Fetch-Site` (403, no CORS), switch and configuration (503), content type JSON (415), body at most 10 KB counted on the stream and valid UTF-8 (413), JSON object (400), honeypot (answers ok, sends nothing), HMAC time token (at least 3 s and at most 1 h old, 400), shared validation (422, all errors at once), rate limit in Cloudflare KV (3 per sender and hour, 30 in total, senders only as salted hashes, counters expire after 2 h, 429), then the mail with fixed sender and recipient and the visitor only as Reply-To (generic 502 on failure, only the error name is logged, never content). The endpoints stay switched off until the variable `CONTACT_ENABLED` is exactly `true`, so nothing is live before the UI and the privacy policy are ready
- [ ] Dashboard settings by Leon for the endpoint (Production and Preview): secret `FORM_SECRET` (at least 32 random characters), KV namespace binding `RATE_LIMIT` (Storage > KV > create a namespace, then project Settings > Bindings). `CONTACT_ENABLED` stays unset until the UI and the privacy policy are merged. Locally: `FORM_SECRET` and `CONTACT_ENABLED=true` in `.dev.vars`, `pnpm dev:functions` provides a local KV
- [x] Contact form UI PR (branch `feat/contact-form-ui`): form in the Contact section (`ContactForm.astro`, browser logic in `src/lib/contact-client.ts` with unit tests), shared validation in the browser (errors on blur and submit, focus on the first problem, `aria-invalid`, live counter), sending and sent states, server errors (422, 429, 502, 503, network) shown without losing the text, honeypot field, time token requested on first interaction (no API call for visitors who only read), no `action` or `method` on the form (without JavaScript it is hidden and a submit could not leak text into the URL), icon row Email, GitHub, LinkedIn (the email button is a CSS-rendered span that JavaScript turns into a mailto link with real text). **Build switch:** the form is only built in with the build variable `PUBLIC_CONTACT_FORM=true` (Astro env schema, default off), so production shows no form until the privacy policy is updated. `pnpm build:form` builds with the switch on; `pnpm test:e2e` and `pnpm lighthouse` use it
- [x] Playwright and axe tests for the form (`tests/e2e/contact.spec.ts`, the API is answered by `page.route` because the browser tests run against the static build): validation, counter, honeypot, sending state, success, server errors, switched off, network failure, keyboard only, axe with visible errors. The real round trip is tested by hand on a preview (`CONTACT_ENABLED` only in Preview)
- [ ] Switch the form on in production together with the privacy policy PR: set the Cloudflare build variable `PUBLIC_CONTACT_FORM` to `true` (Production) and the variable `CONTACT_ENABLED` to `true` (Production), both are plain variables
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
