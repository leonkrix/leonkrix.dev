# Roadmap

Check items off as they are done. Each phase should end in a deployable state. CI must be green before anything is deployed (see CLAUDE.md, "CI/CD").

## Phase 0 - Foundation and tooling

- [ ] Move to Debian (native or WSL2); repo on the Linux filesystem
- [ ] Install Node LTS and pnpm; add `.nvmrc`, `packageManager` field
- [ ] Scaffold Astro (TypeScript strict) + React integration + Tailwind v4
- [ ] `.gitattributes` (LF), `.editorconfig`, `.gitignore`
- [ ] ESLint 9 flat config: typescript-eslint strict (type-aware), astro, react, react-hooks, jsx-a11y, import sorting
- [ ] Prettier + astro and tailwind plugins, `eslint-config-prettier`
- [ ] `tsconfig` strict + `noUncheckedIndexedAccess`; `astro check`
- [ ] Scripts: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `check`
- [ ] Husky + lint-staged pre-commit hooks (optional: commitlint)
- [ ] VS Code settings/extensions recommendations
- [ ] Vitest set up with a first test
- [ ] Self-hosted fonts (Fontsource), design tokens (colors, type scale, spacing) in global CSS
- [ ] Base layout, SEO component (meta, OG), favicon
- [ ] `LICENSE` (All rights reserved, (c) 2026 Leon Krix), short `README.md`
- [ ] `.env.example` (Impressum placeholders), `.env` gitignored, typed env access in Astro
- [ ] GitHub repo `leonkrix/leonkrix.dev` (public), first push (auth via `gh auth login` or SSH key)

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
