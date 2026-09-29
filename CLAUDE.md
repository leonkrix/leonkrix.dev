# leonkrix.dev

Personal portfolio website of **Leon Krix, Software Engineer**. Live at https://leonkrix.dev.
Goal: a modern, minimal, dark, best-practice developer portfolio with subtle animations, a small games section and a few easter eggs. Static site, no backend.

The roadmap lives in [PLAN.md](PLAN.md). Work through it phase by phase; do not jump ahead into games or extras before the MVP is live.

## Repository

- GitHub: `leonkrix/leonkrix.dev` (owner `@leonkrix`), **public**.
- License: **All rights reserved** (`LICENSE` file). Code, texts, images and design are not licensed for reuse. Third-party dependencies keep their own licenses (see `THIRD_PARTY.md` for assets/word lists).
- Default branch `main`, protected (see CI/CD). Work only on feature branches and PRs.
- Because the repo is public and git history is permanent: **never commit** the private postal address, phone number, personal documents, tokens, or `.env` files.

## Language

- Website content and UI: **English**.
- Games: playable in **German and English** (language toggle inside the games only).
- Code, comments, commits: English.

## Development environment

- Primary dev environment: **Debian Linux** (native or WSL2). Repo lives on the Linux filesystem, not under `/mnt/c`.
- Same OS family as CI and Cloudflare builds, so behavior matches production (case-sensitive paths, LF line endings).
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

Runs on every push and every pull request:

1. Checkout, set up Node (from `.nvmrc`) and pnpm, restore cache, `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm format:check`
4. `pnpm typecheck` (`astro check`)
5. `pnpm test` (Vitest unit tests, game logic)
6. `pnpm build`
7. Playwright smoke/e2e tests against the built site (page loads, navigation, games start, no console errors)
8. Lighthouse CI against the built site with assertions (mobile performance, accessibility, best practices, SEO >= 95; fail the check below the budget)
9. `pnpm audit` (fail on high severity), and optionally CodeQL

### Gating deployment behind CI

Decision: **Cloudflare's Git integration deploys, GitHub Actions runs CI in parallel, and branch protection makes CI the gate.** We deliberately do NOT deploy from Actions (no API token, no wrangler-action): it is more moving parts and secrets for no benefit on a static site.

- Cloudflare deploys only `main` to production and builds pull requests as (non-public) preview deployments.
- **Branch protection on `main`** is what enforces the rule: pull requests required, all CI status checks required and green, branch must be up to date before merge, no force pushes, no direct pushes. Since only CI-verified code can reach `main`, production is effectively gated by CI.
- Preview builds run in parallel with CI; that is fine, previews are not production. The CI checks still block the merge.
- No Cloudflare API token or other deploy secrets are needed. Never commit secrets or tokens.
- Workflow hygiene: minimal `permissions:` per workflow/job, pin third-party actions to a full commit SHA (Renovate/Dependabot keeps them updated), `concurrency` groups to cancel superseded runs, cache pnpm store.
- **Dependency updates**: Renovate or Dependabot opens PRs (npm and GitHub Actions); CI validates them before merge.

## Hosting

- Code on GitHub (repo `leonkrix.dev`), `main` is production.
- Hosting: **Cloudflare** (Pages or Workers Static Assets; check which is currently recommended at setup). Free tier, automatic SSL, global CDN. Fallback: Vercel (same setup: Git integration plus branch protection).
- Domain `leonkrix.dev` is registered at IONOS. Mail (`inquiries@leonkrix.dev`) stays at IONOS: **keep the MX records** when changing DNS/nameservers. `.dev` requires HTTPS (HSTS preload).
- Build: `pnpm build` (`astro build`), output `dist/`.

## Site structure

- `/` one-page scroll layout: Hero, About, Featured Projects, Experience (CV timeline), Games teaser, Contact, Footer. Sticky header with anchor links and scroll-spy.
- `/games`, `/games/<game>`: one route per game (code-split, SEO friendly).
- `/impressum`, `/datenschutz`: linked in the footer, never blocked in robots.txt.
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

- **Impressum**: full name, ladungsfaehige Anschrift (no P.O. box), email. Phone is not mandatory if a second fast contact channel exists. Do not cite outdated law (TMG); the current law is DDG. Address may be obfuscated against simple bots but must stay human-readable. Address decision pending (private address vs. paid Impressum service). Use a clearly marked placeholder until decided.
  - **The postal address is never committed to the repo** (public repo, permanent git history). The repo only contains placeholders plus `.env.example` (`IMPRESSUM_STREET`, `IMPRESSUM_ZIP`, `IMPRESSUM_CITY`, ...). Real values are set as **Cloudflare build variables** and in a local, gitignored `.env`, and are injected into the Impressum page at build time (typed/validated env access via Astro). CI builds use the placeholders. These are not secrets (the address is visible on the live page); the goal is only to keep it out of git history. Name and email may live in the repo.
- **Datenschutzerklaerung**: controller, hosting provider (Cloudflare, including third-country transfer note), server logs / IP addresses, contact by email, localStorage for game state (technically necessary), user rights.
- **No cookie banner** as long as there are no non-essential cookies, trackers, embeds (YouTube, maps, social widgets) or third-party CDN resources. Adding any of these requires revisiting the privacy policy first.
- No analytics initially. If added later: privacy-friendly and self-hosted (Plausible/Umami) and documented in the privacy policy.
- `robots.txt`: disallow known AI crawlers (GPTBot, CCBot, ClaudeBot, Google-Extended, ...). This is a request, not protection. Real bot protection comes from Cloudflare settings.
- Games: only use word lists and assets whose license permits it; record sources in `THIRD_PARTY.md`.

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

## Conventions

- Small, focused commits with Conventional Commit messages.
- Never push to `main` directly: work on branches, open PRs, CI must pass, then merge.
- Prefer editing existing components over adding new abstractions. Keep components small and typed.
- Do not add third-party scripts, fonts, or embeds without checking the legal section above.
- Before opening a PR run `pnpm check` locally.
