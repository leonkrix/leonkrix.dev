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
- [x] Live headers checked: securityheaders.com grade A+ (HSTS from `public/_headers`)
- [x] `.github/workflows/codeql.yml` (`javascript-typescript`; PRs, `main`, weekly), pinned actions
- [x] `SECURITY.md` (private vulnerability reporting must be enabled in the GitHub repo settings)
- [ ] Optional, undecided together with commitlint (see Open decisions): PR title check in Conventional Commit format, since PR titles become squash commits. Currently only a convention in CLAUDE.md
- [x] OpenSSF Scorecard workflow and README badge (done in Phase 3A)

## Phase 2 - MVP content

Legal pages first (the site was already live), then the page content in small PRs.

- [x] Typed env access (`astro:env`) for the Impressum variables, placeholders when unset, production build fails when missing
- [x] Shared obfuscated-contact component (CSS-rendered address/phone, assembled email, works without JS); used by Impressum and Datenschutz
- [x] `/impressum` and `/datenschutz` drafted in German with English notice, `noindex`, linked in the footer of every page
- [x] Test: address, placeholders and email are not present as plain text in `dist/`; no mailto link in the HTML (CI job `build` runs `pnpm test:dist`)
- [ ] Review the legal texts against a generator (eRecht24 / IT-Recht Kanzlei) and adjust. **Deliberately postponed until Phase 4 (games)**, because games add localStorage and word lists, so the texts change again. The supervisory authority is kept generic on purpose (naming the state would reveal the address region)

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

Phase 2 is complete. What remains is small content polish (see the open follow-ups above, to be done step by step whenever there is something new to show).

## Phase 3 - Quality gates, contact form, design polish

Order (decided): 3A quality gates first, then 3B the contact form (so its browser tests have the infrastructure), then 3C design polish and animations.

### 3A Quality gates

- [x] CI job `e2e` (part of `CI passed`): Playwright against the production build on desktop and mobile; smoke tests for navigation, mobile menu, skip link, email link, external links, legal pages, 404, no horizontal scrolling, reduced motion; every test also fails on console errors, CSP violations and HTTP errors
- [x] Privacy guard test (Playwright): only same-origin requests and no cookies on every page, including the 404 page (Cloudflare's `__cf_bm` only appears in production with bot protection; if it ever shows up in a test, allow exactly that cookie)
- [x] Accessibility: `@axe-core/playwright` scan of every page against WCAG 2.2 AA and best practices, currently no violations
- [x] CI job `lighthouse` (part of `CI passed`): `scripts/lighthouse.mjs` runs Lighthouse (mobile, simulated throttling) three times against the production build and takes the median; every category must reach 95 (measured on 2026-10-01 with the contact form built in: performance 98, accessibility 100, best practices 100, SEO 100), budgets for transferred bytes (scripts 10 KB, stylesheets 20 KB, total 200 KB; measured 4.5, 7.1 and 134 KB) and no request to another origin. The report is uploaded as an artifact. We use Lighthouse directly (13.x) and not `@lhci/cli`, which is barely maintained and would pull old dependencies into `pnpm audit`
- [x] CI job `audit` (part of `CI passed`): `pnpm audit --audit-level high` on every pull request and push (currently no known vulnerabilities); the same audit also runs weekly in `security.yml`. OpenSSF Scorecard runs in `.github/workflows/security.yml` (push to `main`, weekly, on branch protection changes) with published results and SARIF upload to the Security tab
- [x] First Scorecard run: 6.7 of 10. Everything we can influence is 10 (dangerous workflows, token permissions, vulnerabilities, update tool, security policy, pinned dependencies, binaries, CI tests). Expected to rise by itself: Maintained (needs a repository age of 90 days) and SAST (older commits leave the window). Not applicable and intentionally left: Code-Review (GitHub does not let authors approve their own pull requests, so a required approval would block every merge in a solo project), Branch-Protection (partly needs approvals), Fuzzing, CII Best Practices (needs an open source license), Contributors, Packaging, Signed-Releases. Dismiss the not-applicable code scanning alerts as "Won't fix" with a reason
- [x] The new jobs (e2e, lighthouse, audit) are in `needs` of `ci-ok`; no branch protection change was needed
- [x] Keep the portfolio in sync: Playwright, axe and Lighthouse are in the registry and the website project; the key figure "95+ Lighthouse in every category (enforced in CI)" is on the website card

- [x] Stronger pre-commit hook: project-wide type check and related unit tests when code is staged (a type error slipped past the old hook to CI once); build warnings about Shiki and the CSP style directive removed (`markdown.syntaxHighlight: false`, style elements scoped with `kind: element`)
- [x] README rewritten: badges (CI, CodeQL, OpenSSF Scorecard, live site, license), quality gates table, scripts, project structure. Badges live in the README only, on the website they would be third-party requests. Keep it in sync when jobs or scripts are added (the Scorecard badge always shows the current score). A PR template with a self-check list was considered and rejected: solo project, a checklist only its author reads adds ceremony
- [x] The e2e job no longer hangs after the tests on GitHub (first runs hung inside `pnpm test:e2e` before the summary was printed, most likely while stopping the web server). Fixes: the server is a single process (`astro preview` directly), the build runs before Playwright, `gracefulShutdown`, an 8 minute global timeout, an 8 minute step timeout and the list reporter. Verified green. Plan B if it returns: start the preview server in the workflow as a background process with its output redirected to a file

### 3B Contact form (decided: yes, free, with JavaScript)

Decisions (all implemented, the form is **live in production**): fields name, email and message; requires JavaScript (progressive enhancement is not worth the extra surface); without JavaScript the form stays hidden and the section shows the row of buttons (Email, GitHub, LinkedIn). The Contact section is: short text, the form, and a uniform row of icon buttons; the large email card is gone. Calm card styling with clear states (empty, error, sending, sent). Details and configuration are in CLAUDE.md, "Contact form".

- [x] Spike on a throwaway branch (done, see the next item): a Cloudflare Pages Function that sent one test mail through the existing IONOS mailbox via SMTP. Decided: the IONOS plan has exactly one mailbox, so `hello@leonkrix.dev` is both sender and recipient (Reply-To is the visitor). The mailbox password is a Cloudflare **Secret** (runtime, encrypted; NOT a build variable), locally in `.dev.vars` (gitignored, read by Wrangler); it gives access to the whole mailbox: long, unique, never logged, rotated if it may have leaked
- [x] Spike DONE, it works: SMTP through smtp.ionos.de:587 (STARTTLS, auth plain) with `worker-mailer`, locally (about 470 ms) and on a real Cloudflare preview deployment (about 420 ms, real Cloudflare colo), mail arrives in `hello@`. So IONOS accepts connections from Cloudflare and the Free plan CPU limit is enough. **Decision: the contact form uses the IONOS mailbox via SMTP, no third party.** Facts: Cloudflare **Pages** project `leonkrix-dev`; Functions in `functions/`, compatibility flag `nodejs_compat` (command line and dashboard, see the lesson below), non-secret mail settings as constants in `functions/_lib/config.ts`; secrets are per environment (production and preview are separate): set preview secrets with `wrangler pages secret put NAME --project-name leonkrix-dev --env preview` (value typed hidden), a new deployment is needed afterwards; preview deployments have no Impressum variables on purpose; `.dev.vars` is protected from Claude Code by a Read deny rule in the personal, untracked `.claude/settings.json` (content in CLAUDE.md, "Secrets and Claude Code")
- [x] Lesson from merging the foundation PR: the production build FAILED (the live site stayed on the last good deployment) because a `wrangler.jsonc` in the repository makes Cloudflare Pages ignore the dashboard variables at build time, including `IMPRESSUM_*`. Fixed by removing the file: the mail settings are constants in `functions/_lib/config.ts`, only `SMTP_PASSWORD` is a secret, compatibility flags go on the command line (scripts) and into the dashboard, and a guard test forbids any Wrangler config file in the repository
- [x] Fallback (Cloudflare Email Sending about 5 USD per month, or Brevo or Resend) is not needed; keep the mailer behind the small `sendMail` interface in `functions/_lib/smtp-mailer.ts` so it could be swapped
- [x] Foundation PR (branch `feat/contact-form-foundation`): spike endpoint removed, placeholder `POST /api/contact` (503 "not available yet") so `functions/` is valid and deployable, `functions/_lib/smtp-mailer.ts` with unit tests (mocked transport, config validation, always closes the connection), `pnpm typecheck` covers the Functions, Vitest runs `functions/**/*.test.ts`, CI job `build` runs `pnpm build:functions`, `pnpm dev:functions` for local runs, docs
- [x] Dashboard setting by Leon: compatibility flag `nodejs_compat` and compatibility date 2026-09-29 for Production and Preview
- [x] Spike cleanup: `SPIKE_TOKEN` secret deleted, branch `spike/ionos-smtp` is gone from the repository. Optional for Leon: remove the old spike preview deployments in the Cloudflare dashboard (harmless, they only clutter the list)
- [x] Shared validation rules in `src/lib/contact.ts` (plain TypeScript, no dependencies, no DOM or Workers types; used by the browser and the Function) with 140 unit tests: name 2-80 characters, at least one letter or digit, line breaks and tabs become spaces, NFC; email ASCII only, at most 254 and 64 before the @, procedural check in linear time (no regex backtracking), header injection attempts rejected; message 20-2000 characters counted as people see them (emoji = 1), trimmed, CRLF to LF, control characters and bidi spoofing characters rejected, joiners for emoji allowed; honeypot field `website`; errors have a code and a text for the visitor, all problems are reported at once. A repository guard test forbids hidden bidirectional or control characters in source files ("Trojan Source")
- [x] Endpoint PR (branch `feat/contact-form-endpoint`): `POST /api/contact` and `GET /api/contact-token`, logic in `functions/_lib/contact-handler.ts`, fully unit tested with a mocked mailer and an in-memory KV. Checks in this order: method (405), Origin must equal the own origin plus `Sec-Fetch-Site` (403, no CORS), switch and configuration (503), content type JSON (415), body at most 10 KB counted on the stream and valid UTF-8 (413), JSON object (400), honeypot (answers ok, sends nothing), HMAC time token (at least 3 s and at most 1 h old, 400), shared validation (422, all errors at once), rate limit in Cloudflare KV (3 per sender and hour, 30 in total, senders only as salted hashes, counters expire after 2 h, 429), then the mail with fixed sender and recipient and the visitor only as Reply-To (generic 502 on failure, only the error name is logged, never content). The endpoints stay switched off until the variable `CONTACT_ENABLED` is exactly `true`, so nothing is live before the UI and the privacy policy are ready
- [x] Dashboard settings by Leon for the endpoint: secret `FORM_SECRET`, KV binding `RATE_LIMIT` (namespace `leonkrix-contact-rate-limit`), Production and Preview. Preview no longer carries the old spike variables (`MAIL_FROM` and friends)
- [x] Contact form UI PR (branch `feat/contact-form-ui`): form in the Contact section (`ContactForm.astro`, browser logic in `src/lib/contact-client.ts` with unit tests), shared validation in the browser (errors on blur and submit, focus on the first problem, `aria-invalid`, live counter), sending and sent states, server errors (422, 429, 502, 503, network) shown without losing the text, honeypot field, time token requested on first interaction (no API call for visitors who only read), no `action` or `method` on the form (without JavaScript it is hidden and a submit could not leak text into the URL), icon row Email, GitHub, LinkedIn (the email button is a CSS-rendered span that JavaScript turns into a mailto link with real text). **Build switch:** the form is only built in with the build variable `PUBLIC_CONTACT_FORM=true` (Astro env schema, default off), so production shows no form until the privacy policy is updated. `pnpm build:form` builds with the switch on; `pnpm test:e2e` and `pnpm lighthouse` use it
- [x] Playwright and axe tests for the form (`tests/e2e/contact.spec.ts`, the API is answered by `page.route` because the browser tests run against the static build): validation, counter, honeypot, sending state, success, server errors, switched off, network failure, keyboard only, axe with visible errors. The real round trip is tested by hand on a preview (`CONTACT_ENABLED` only in Preview)
- [x] Switched on in production: `PUBLIC_CONTACT_FORM` and `CONTACT_ENABLED` set to `true`, redeployed, form visible and test messages arrive in `hello@`
- [x] Privacy policy PR (branch `feat/privacy-policy-contact-form`): new section for the contact form (data, hashed counter, purpose, legal basis, path of the message, recipients, storage period, no obligation), sections on cookies and storage on the device (section 25 TDDDG) and no automated decisions, objection notice (Art. 21), supervisory authority, extended email section (section 257 HGB, section 147 AO), Impressum mentions the form as second contact channel. The sections exist only when the form is built in. Website project, About text and form notice updated
- [x] Function tests run in CI through `pnpm test` and `pnpm build:functions` (job `build`), secrets and the KV binding are set in Cloudflare, local development with `pnpm dev:functions` and `.dev.vars` is documented
- [ ] Optional later: Cloudflare Turnstile only if spam appears (needs a CSP change and a privacy policy update)

Phase 3A and 3B are complete. The next step is 3C.

### 3C Design polish and animations

- [x] Animated background (`src/components/Background.astro` and the "Animated background" block in `global.css`), reworked twice after Leon's feedback: grid lines behind reading text were distracting, and the cursor light felt like a searchlight, so it was removed again (the cursor stays a normal cursor). Result, **no script at all**: (1) every page has a calm fixed layer of two huge, very soft color fields that drift slowly (70 s and 90 s, static for reduced motion), (2) only the home page hero has the "hero light": soft light from the top and a fine grid that appears from the top right corner and fades out, scrolling away with the hero so text blocks never sit on grid lines (it also sets the hero apart from the rest), (3) legal pages and any page with `calm` get no grid. Hidden from assistive technology, ignores the pointer. Tuning values are at the top of the CSS block
- [x] Button effects (`.btn-primary` and `.btn-outline` in `global.css`): primary buttons lift 1 px, get a soft accent shadow and a light sheen that sweeps across on hover and are pressed (scale 0.97) on click; outline buttons get an accent border, a faint accent wash and a thin glow ring; icons nudge a little (arrow down, paper plane). Hover only on devices that can hover, no movement for reduced motion. Used by the hero, the contact form, project links, profile links and the 404 page
- [x] Card edge shimmer (`.edge` in `global.css`): every box (project cards, contact form and success box, 404 terminal, legal notice, experience icon tiles) has a faint, permanent gradient on its border (accent at the top left, cyan at the bottom right), weaker than the button hover. Use `edge` on every new box
- [x] Header navigation: the active section and hover show a thin accent-to-cyan underline that grows from the left; the text is no longer blue (active is white). Mobile menu: active entry has a thin accent bar on the left
- [x] Logo easter egg: while hovering the wordmark the cursor blinks fast and the chevron nudges to the right (CSS only, nothing for reduced motion)
- [x] Bug fix: browser back or forward during a smooth scroll now stops the running scroll and follows the address bar (`popstate` handler in `Header.astro`, tests in `tests/e2e/scroll.spec.ts`). **Keep this in mind for the scroll animations**: any scroll-driven effect must not fight the browser history or anchor navigation
- [x] Bug fix: the vertical line of the projects timeline now starts at the center of the first dot instead of sticking out above it
- [x] Availability badge (`AvailabilityBadge.astro`, `.badge-ring` and `.badge-glow`): a slow breathing ring around the green dot (3.2 s, instead of the fast ping), a faint green glow that pulses on the pill (4.5 s) and an arrow that slides in on hover to show that it leads to the contact section. Static for reduced motion
- [x] Timeline strip above the experience list (`ExperienceTimeline.astro`, layout in `src/lib/timeline.ts` with unit tests): bars for every experience entry on two lanes (education blue, work cyan) over whole years from the first start to the end of the last year, a faint line per year, and a highlighted band where a job ran next to studies (the teaching assistant job during the bachelor's degree). Calculated from the experience data, so a new entry appears by itself; an entry without end date runs until today and fades out at its end; overlapping entries of one type get their own rows. New optional field `short` in the experience schema for the label on the bar. The bars grow in from the left when the strip is revealed. Desktop only, hidden from assistive technology (the list carries the same information), the list stays alone on small screens
- [x] Hero entrance (`.hero-in` with `--i` per element): badge, greeting, name, role, intro, buttons and profile links rise in one after the other (about 650 ms each, 80 ms apart, CSS only). The animation uses fill mode "backwards", so after it ends the normal styles apply and button hover effects keep working. Lighthouse performance stays at 98 (the name is the largest paint, so the stagger stays short)
- [x] Scroll reveals (`.reveal`, `src/components/Reveal.astro`): blocks that start below the visible area (About paragraphs, technology groups, project cards, experience groups, the contact blocks, section headers) fade in and rise 36 px over about 0.7 s when they scroll into view, one time; blocks that arrive together follow each other 90 ms apart. First built as a CSS scroll-driven animation (`animation-timeline: view()`) and replaced after Leon's feedback: it was tied to the scroll position, happened at the very bottom edge of the screen and was practically invisible. The current version is time based (a scroll listener adds and removes `reveal-pending`), so it is clearly perceivable but still calm. Safety: without JavaScript or with reduced motion nothing is ever hidden; blocks scrolled past in one jump (End key, anchor link) are shown at once without effect; hiding below-the-fold blocks happens without a fade-out. It cannot fight browser history or anchor links because it only reacts to where blocks are, not to scroll animations. Tests: `tests/e2e/motion.spec.ts`; the axe scans run with reduced motion so contrast is measured on final colors
- [x] Page transitions: **tried and dropped.** Built with the native `@view-transition { navigation: auto }` (header and background kept in place, 200 ms cross-fade), but Chrome intermittently aborted the transition when navigating right after a page load and logged an unhandled rejection ("Transition was aborted because of invalid state. ViewTransition opt-in disabled"). It failed our console-error check in about half of the repeated runs, and handling the promises in `pageswap` and `pagereveal` did not help. The gain (a fade between the home page and the legal pages) is too small for a console error that visitors' developer tools would show. Retry when Chrome fixes this; the CSS was about ten lines
- [x] Reduced-motion handling and automated accessibility pass: every animation (hero entrance, reveals, background drift, button effects, logo easter egg) is switched off or static with `prefers-reduced-motion`, and tests check it; axe finds no violations on any page (also with form errors visible); the contact form is tested with the keyboard only; focus styles are visible; hover effects only on devices that can hover
- [ ] Optional, by Leon: one manual pass with the keyboard only (Tab through every page) and with a screen reader (NVDA on Windows) before the first public announcement. Automated tests cannot judge reading order or wording
- [x] OG image (`public/og.png`, 1200 x 630, about 150 KB): wordmark, "Hello, I'm", the name, the role in the blue to cyan gradient, the domain, on the dark background with the hero light and grid. Made by `scripts/generate-og.mjs` (`pnpm og`): a screenshot of a small HTML page with the same fonts (Fontsource files), colors and wordmark as the site, rendered by the Chromium that Playwright already provides, so there is no extra dependency. The text comes from `siteConfig`. **The PNG is committed** (a production build must not depend on a browser); run `pnpm og` again after changing the name, role, wordmark or colors. Every page uses it as `og:image` and `twitter:image` (Twitter card summary_large_image, with width, height and alt text); build-output tests check the tags and that the file is a 1200 x 630 PNG below 500 KB

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
