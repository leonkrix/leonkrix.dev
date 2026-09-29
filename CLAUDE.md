# leonkrix.dev

Personal portfolio website of **Leon Krix, Software Engineer**. Live at https://leonkrix.dev.
Goal: a modern, minimal, dark, best-practice developer portfolio with subtle animations, a small games section and a few easter eggs. Static site, no backend.

The roadmap lives in [PLAN.md](PLAN.md). Work through it phase by phase; do not jump ahead into games or extras before the MVP is live.

## Repository

- GitHub: `leonkrix/leonkrix.dev` (owner `@leonkrix`), **public**.
- License: **All rights reserved** (`LICENSE` file). Code, texts, images and design are not licensed for reuse. Third-party dependencies keep their own licenses (see `THIRD_PARTY.md` for assets/word lists).
- Default branch `main`, protected by the GitHub ruleset `protect-main`: pull request required (0 approvals, solo project), squash merge only, required status check **`CI passed`**, branch must be up to date, no force pushes, no deletions, no bypass. Work only on feature branches and PRs; head branches are deleted automatically after merge.
- Dependabot (weekly, grouped), secret scanning and push protection are enabled.
- Because the repo is public and git history is permanent: **never commit** the private postal address, phone number, personal documents, tokens, or `.env` files.

## Language

- Website content and UI: **English**.
- Games: playable in **German and English** (language toggle inside the games only).
- Code, comments, commits: English.

## Development environment

- Currently developed on **native Windows** with WebStorm (Node 24 LTS, pnpm via Corepack/npm). Debian (native or WSL2, repo on the Linux filesystem) is also supported; both must keep working.
- CI and Cloudflare builds run on Linux, so avoid Windows-only assumptions (case-sensitive paths, LF line endings, no `rm -rf`/bash-only npm scripts).
- Toolchain pins: **TypeScript 6.x** (typescript-eslint and `astro check` do not support TS 7 yet), **ESLint 10.x**. Do not re-add `eslint-plugin-react` (crashes on ESLint 10); React linting uses `@eslint-react/eslint-plugin`, `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y` (one known harmless peer warning for jsx-a11y).
- Pin the toolchain: `.nvmrc` (Node LTS) and the `packageManager` field in `package.json` (pnpm). CI reads the same versions.
- `.gitattributes`: `* text=auto eol=lf`. `.editorconfig` for basic editor settings.

## Tech stack

- **Astro** (static output) + **TypeScript** (strict) + **React** islands only where interactivity is needed (games, command palette).
- **Tailwind CSS v4** with design tokens as CSS variables.
- **Motion** (ex Framer Motion) for UI animation; optionally GSAP ScrollTrigger. Always honor `prefers-reduced-motion`.
- **Astro Content Collections** (Zod-typed) for projects, experience and site data.
- **pnpm** as package manager.
- Fonts: **self-hosted** (Fontsource). Never load fonts or scripts from third-party CDNs (GDPR).

## Code quality tooling (local + CI)

The same checks run locally, in pre-commit hooks and in CI. If a check fails locally it must fail in CI too, and vice versa.

- **ESLint 9 (flat config)** with `typescript-eslint` (strict + stylistic, type-aware rules), `eslint-plugin-astro`, `eslint-plugin-react` + `react-hooks`, `eslint-plugin-jsx-a11y` (accessibility), and an import-order/sorting plugin. Optionally `eslint-plugin-unicorn` for extra best-practice rules.
  - Note on Airbnb: `eslint-config-airbnb` is effectively unmaintained and does not work well with ESLint 9 flat config, TypeScript and Astro. Instead we replicate its intent (strict, consistent, opinionated) using the modern rule sets above. Do not add the Airbnb config.
- **Prettier** (+ `prettier-plugin-astro`, `prettier-plugin-tailwindcss`) as the single formatter. ESLint does not do formatting (use `eslint-config-prettier` to avoid conflicts).
- **TypeScript**: `astro check` / `tsc --noEmit` with `strict` (plus `noUncheckedIndexedAccess`).
- **Pre-commit hooks**: Husky + lint-staged (eslint --fix, prettier --write on staged files). Optional commit message lint (commitlint, Conventional Commits).
- **Editor**: `.vscode/settings.json` / recommended extensions committed for format-on-save and ESLint.
- **Scripts** (`package.json`): `dev`, `build`, `preview`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:e2e`, `check` (runs lint + format:check + typecheck + test + build, the same as CI).

## CI/CD (GitHub Actions is mandatory)

We always use **GitHub Actions**. **Nothing is deployed unless CI is green.** This is a hard rule, not a nice-to-have.

### CI (`.github/workflows/ci.yml`)

Runs on every pull request and on pushes to `main`. Structure: a reusable composite action `.github/actions/setup` (pnpm + Node from `package.json`/`.nvmrc`, cached, `pnpm install --frozen-lockfile`, `HUSKY=0`), parallel jobs, and one aggregate job `ci-ok` ("CI passed") that `needs` all others. **Branch protection requires only `ci-ok`**, so new jobs are added to its `needs` list without touching repository settings.

Jobs (existing = live in the workflow; planned = added in the phase noted in PLAN.md):

1. `quality` (live): `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (`astro check`)
2. `test` (live): `pnpm test` (Vitest)
3. `build` (live): `pnpm build`
4. `site-checks` (live, part of the `build` job): `pnpm test:dist` runs Vitest checks against the build output in `dist/` (see Testing strategy)
5. `e2e` (planned, phase 3): Playwright smoke tests plus axe accessibility scans against the built site
6. `lighthouse` (planned, phase 3): Lighthouse CI with budgets (mobile performance, accessibility, best practices, SEO >= 95)
7. `actionlint` (live): lints the workflow files; the binary is pinned by version and SHA-256 checksum (bump both together, Dependabot cannot update it)
8. `dependency-review` (live, pull requests only, fails on high severity; skipped on pushes, which does not fail the gate)
9. `security` (planned, phase 3): `pnpm audit` (high severity)

Separate workflows (not part of the `ci-ok` gate at first, findings show as PR checks and in the Security tab): **CodeQL** (live: `codeql.yml`, requires that the repo setting "Code scanning default setup" is NOT enabled, otherwise the two conflict) (`javascript-typescript`, on PRs, `main` and weekly) in `.github/workflows/codeql.yml`, and later **OpenSSF Scorecard**. `SECURITY.md` and private vulnerability reporting are enabled.
**SonarQube Cloud is deliberately not used**: it overlaps almost entirely with ESLint, strict TypeScript and CodeQL, does not create PRs, and needs an external account plus a token secret. Revisit only as an experiment.

### Testing strategy

Tests exist to protect what would actually hurt: broken pages, legal pages missing, accessibility/performance regressions, privacy leaks, and broken game logic. Not to hit coverage numbers.

- **Unit (Vitest)**: pure game logic (Wordle evaluation, daily word from date, dictionary validation, Clueless ranking), utilities, content schemas. Word lists get data tests (length, lowercase, no duplicates, valid characters).
- **Content validation**: Zod schemas on content collections so bad data fails the build (e.g. private projects must not carry a repo link).
- **Build-output checks (Vitest over `dist/`)**: every page has `<title>`, meta description, canonical, `lang`; `/impressum` and `/datenschutz` exist and are linked from the footer of every page; `robots.txt` and `sitemap.xml` exist; no broken internal links; no `http://` resources; Impressum placeholders are not left in production output.
- **Privacy guard (Playwright)**: assert that page loads make requests only to our own origin (no third-party fonts/scripts/embeds), and set no cookies. This protects the "no cookie banner" decision.
- **E2E smoke (Playwright)**: home loads, header anchors scroll to sections, mobile viewport, games start and the language toggle works, keyboard navigation, reduced-motion respected, no console errors.
- **Accessibility**: `@axe-core/playwright` scan of every page, fail on violations.
- **Performance/SEO**: Lighthouse CI budgets plus a JS bundle size budget.
- **Security hygiene**: `pnpm audit`, dependency review, CodeQL, secret scanning (public repo, so GitHub secret scanning and push protection are enabled).
- Not planned: visual regression snapshots (high maintenance for low value on a personal site), coverage thresholds.

### Gating deployment behind CI

Decision: **Cloudflare's Git integration deploys, GitHub Actions runs CI in parallel, and branch protection makes CI the gate.** We deliberately do NOT deploy from Actions (no API token, no wrangler-action): it is more moving parts and secrets for no benefit on a static site.

- Cloudflare deploys only `main` to production and builds pull requests as (non-public) preview deployments.
- **Branch protection on `main`** is what enforces the rule: pull requests required, all CI status checks required and green, branch must be up to date before merge, no force pushes, no direct pushes. Since only CI-verified code can reach `main`, production is effectively gated by CI.
- Preview builds run in parallel with CI; that is fine, previews are not production. The CI checks still block the merge.
- **Build budget**: production builds happen only when a PR is merged into `main`. Preview builds are triggered by pushes to branches/PRs and count against Cloudflare's free build allowance. So: commit as often as you like locally, but **push a feature branch when the feature is complete** (or open a draft PR), one branch per complete feature. Restrict preview builds in the Cloudflare project's branch control if needed. GitHub Actions minutes are unlimited for public repos, so CI runs are not a concern.
- Dependabot PRs are grouped weekly to limit preview builds.
- No Cloudflare API token or other deploy secrets are needed. Never commit secrets or tokens.
- Workflow hygiene: minimal `permissions:` per workflow/job, pin third-party actions to a full commit SHA (Renovate/Dependabot keeps them updated), `concurrency` groups to cancel superseded runs, cache pnpm store.
- **Dependency updates**: Renovate or Dependabot opens PRs (npm and GitHub Actions); CI validates them before merge.

## Hosting

- Code on GitHub (repo `leonkrix.dev`), `main` is production.
- Hosting: **Cloudflare** via its Git integration (project connected to `leonkrix/leonkrix.dev`, production branch `main`). Free plan, no payment method on file, automatic SSL, global CDN. Fallback: Vercel (same setup: Git integration plus branch protection).
- DNS is managed at Cloudflare (nameservers switched); the domain stays registered at IONOS. `leonkrix.dev` and `www` are attached to the project, `www` redirects to the apex domain. Mail DNS records (MX, SPF, DKIM, `autodiscover`, `_dmarc`) must stay untouched and set to "DNS only".
- Costs: Cloudflare Free and GitHub Free (public repo) are not usage-billed. Only the IONOS domain and mailbox cost money (watch renewal price).
- Domain `leonkrix.dev` is registered at IONOS. Mail (`hello@leonkrix.dev`) stays at IONOS: **keep the MX records** when changing DNS/nameservers. `.dev` requires HTTPS (HSTS preload).
- Build: `pnpm build` (`astro build`), output `dist/`.

## Site structure

- `/` one-page scroll layout: Hero, About, Featured Projects, Experience (CV timeline), Games teaser, Contact, Footer. Sticky header with anchor links and scroll-spy.
- `/games`, `/games/<game>`: one route per game (code-split, SEO friendly).
- `/impressum`, `/datenschutz`: linked in the footer of every page, not disallowed in robots.txt, but with `noindex` meta (so search engines do not list them yet crawlers can still read the tag).
- `/404`: creative (terminal style).

## Content model

- **Experience timeline** (CV): education, work, internships, certificates. Also downloadable as CV PDF.
- **Featured projects**: separate from the timeline. Each has `visibility: "public" | "private"`.
  - public: GitHub link, description, stack.
  - private: description, screenshots, stack, no code link.
- Start with placeholder data; real content is swapped in later via the collections only.
- Contact: `mailto:` only, no contact form (avoids data processing). Links: GitHub, LinkedIn, email. More links can be added later.
- No photo for now.

## Design guidelines

- Dark, minimal, generous whitespace, strong typography. No bright/colorful noise.
- **Palette**: cool blue accent family (blue -> cyan/teal as analogous colors) plus one restrained contrast accent (e.g. warm amber) used sparingly. Tokens (starting point, tune during design phase):
  - bg `#0a0d12`, surface `#11161d`, border `#1e2632`
  - text `#e6edf3`, muted `#8b98a9`
  - accent `#4f8cff`, accent-2 `#22d3ee`, contrast `#f5b642`
- Subtle animation: background (grain/noise, slow gradient glow or fine grid, cursor-following glow), scroll reveals, hero text animation. Keep it lightweight (CSS/canvas), must not hurt Lighthouse.
- Mobile-first, responsive, WCAG AA contrast, full keyboard navigation, visible focus styles.
- Use design tokens; no magic colors or spacing values in components.

## Quality bar

- Lighthouse 95+ in all four categories on mobile (enforced in CI).
- Minimal JS shipped: hydrate islands with `client:visible` / `client:idle`; games are lazy loaded.
- Valid semantic HTML, meta tags, Open Graph images, `sitemap.xml`, JSON-LD (`Person`).
- TypeScript strict, no `any` without justification.
- Unit tests for all game logic; e2e smoke tests for critical paths.

## Legal (Germany) - must stay correct

Not legal advice; have the final texts checked (e.g. eRecht24 / IT-Recht Kanzlei generator).

- **Impressum**: full name, ladungsfaehige Anschrift (no P.O. box), email. Phone is not mandatory if a second fast contact channel exists. Do not cite outdated law (TMG); the current law is DDG. Decision: the **private postal address** is used. It is obfuscated against simple bots as far as possible while staying legally correct (human-readable, no JavaScript required, screen-reader friendly).
  - **Obfuscation approach** (one shared component used by Impressum and Datenschutz): address and phone are never emitted as continuous text in the HTML; they are split into parts and rendered via CSS (`::before { content: attr(data-...) }`), which works without JS and is read by screen readers. The email is assembled from parts (small progressive-enhancement script makes it a clickable link; without JS it stays visible through the CSS output). No images of text (accessibility). A build-output test asserts that the address does not appear as plain text in `dist/`. Additional protection at the edge: Cloudflare Bot Fight Mode, AI-bot blocking and email address obfuscation. Honest limit: a scraper that renders CSS/JS can still read it; this only stops simple crawlers and harvesters.
  - **The postal address is never committed to the repo** (public repo, permanent git history). The repo only contains placeholders plus `.env.example` (`IMPRESSUM_STREET`, `IMPRESSUM_ZIP`, `IMPRESSUM_CITY`, ...). Real values are set as **Cloudflare build variables** and in a local, gitignored `.env`, and are injected into the Impressum page at build time (typed/validated env access via Astro). CI builds use the placeholders. These are not secrets (the address is visible on the live page); the goal is only to keep it out of git history. Name and email may live in the repo.
- Legal pages are written in **German** (German law applies) with a short English notice at the top; the rest of the site stays English. No phone number is published: the email address is the contact channel (a contact form is a possible later addition, see PLAN.md, and would need a privacy policy update).
- **Datenschutzerklaerung**: controller, hosting provider (Cloudflare, including third-country transfer note), server logs / IP addresses, contact by email, localStorage for game state (technically necessary), user rights.
- Cloudflare may set a technically necessary security cookie (`__cf_bm`) when bot protection is on; this is mentioned in the privacy policy. The site itself sets no cookies, so a privacy-guard test must only allow such Cloudflare security cookies.
- **No cookie banner** as long as there are no non-essential cookies, trackers, embeds (YouTube, maps, social widgets) or third-party CDN resources. Adding any of these requires revisiting the privacy policy first.
- No analytics initially. If added later: privacy-friendly and self-hosted (Plausible/Umami) and documented in the privacy policy.
- `robots.txt`: disallow known AI crawlers (GPTBot, CCBot, ClaudeBot, Google-Extended, ...). This is a request, not protection. Real bot protection comes from Cloudflare settings.
- Games: only use word lists and assets whose license permits it; record sources in `THIRD_PARTY.md`.
- **Revisit the legal texts whenever the site changes**: games (localStorage for game state, word lists), a contact form (data processing, processor agreement, Turnstile), analytics, embeds, or any new third-party service. The privacy policy must always match what the site actually does.

## Games (after MVP)

Order: Wordle (DE/EN, daily word derived deterministically from the date, no backend) -> more small games (2048, Minesweeper, Snake, typing test, "guess the language", ...) -> Clueless.

**Clueless** (Semantle/Contexto-like): guess a word, see how close it is to the secret word by rank/number and color (e.g. under 100 = green). Needs word embeddings per language; use a limited vocabulary (~20-30k words), and precompute the ranking for each daily word offline with a build script, shipped as small static files. Dedicated task after other games.

Game logic must be pure TypeScript (unit tested with Vitest), separate from React UI. Games must stay lightweight and work without a backend.

## Easter eggs / extras (later)

Command palette (Cmd/Ctrl+K), terminal-style easter egg, `/uses` page, blog (MDX). Not part of MVP.

## Decisions and rationale

- **Astro over plain React/Next.js**: static one-pager, minimal JS, React only as islands. No MERN/backend needed.
- **Cloudflare over Vercel**: free forever, unlimited bandwidth, commercial use allowed (Vercel Hobby is non-commercial only). Vercel is the fallback.
- **Git integration + branch protection over deploying from Actions**: no API tokens or deploy secrets, fewer moving parts; branch protection guarantees only CI-green code reaches `main`.
- **No Airbnb ESLint config**: unmaintained, incompatible with ESLint 9 / TypeScript / Astro. Modern strict rule sets instead.
- **No cookie banner, no analytics, no third-party embeds/CDNs**: keeps the site legally simple (self-hosted fonts, `mailto:` instead of a contact form).
- **All rights reserved instead of MIT**: texts, images and design should not be freely reusable.
- **Impressum address kept out of git**: injected via build variables; alternatives to a private address are a paid Impressum/c-o service (roughly 5-20 EUR/month); a fully anonymous Impressum is not legally possible (name and serviceable address are mandatory).
- **Mail stays at IONOS, DNS moves to Cloudflare**: copy the IONOS MX records before switching nameservers.
- **Games are optional fun, not the core**: MVP first.
- **CodeQL yes, SonarQube Cloud no**: CodeQL is free, GitHub-native and useful once games handle user input; Sonar would duplicate ESLint/TypeScript/CodeQL findings and adds an external service and a secret.
- **Single required check `CI passed`**: an aggregate job so new CI jobs never require changing the ruleset.
- **Private address in the Impressum, obfuscated**: see Legal. Legal pages come right after Phase 1, before design work.
- **Cloudflare baseline, not more**: Full (strict), Always HTTPS, min TLS 1.2, Bot Fight Mode, AI bot blocking. **Keep off**: Web Analytics (third-party script, breaks the privacy promise), Rocket Loader (rewrites scripts, conflicts with CSP), managed robots.txt (robots.txt lives in the repo). DNSSEC and HSTS are deliberately not enabled (small benefit, outage risk; `.dev` is HSTS-preloaded). Security headers live in the repo (`public/_headers`), not in the dashboard.
- **Workflow actions are pinned to full commit SHAs**: IDE inspections may flag their inputs as undefined (false positive, the IDE cannot resolve metadata for SHA refs).

## Conventions

- Small, focused commits with Conventional Commit messages.
- Never push to `main` directly: work on branches, open PRs, CI must pass, then merge.
- Prefer editing existing components over adding new abstractions. Keep components small and typed.
- Do not add third-party scripts, fonts, or embeds without checking the legal section above.
- Before opening a PR run `pnpm check` locally.
- The PR title becomes the squash commit message: write it as a Conventional Commit (`feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`, `ci: ...`).
- Commit locally as often as you like, but push a branch only when the feature is complete (each push builds a Cloudflare preview).
- New external links use the `ExternalLink` component (`target="_blank"`, `rel="noopener noreferrer"`).
- In the WebStorm commit dialog, "Analyze code" is off (lint-staged and CI already cover it); `dist/` and `.astro/` are marked as excluded.
