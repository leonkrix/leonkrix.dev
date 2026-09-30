# leonkrix.dev

[![CI](https://github.com/leonkrix/leonkrix.dev/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/leonkrix/leonkrix.dev/actions/workflows/ci.yml)
[![CodeQL](https://github.com/leonkrix/leonkrix.dev/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/leonkrix/leonkrix.dev/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/leonkrix/leonkrix.dev/badge)](https://scorecard.dev/viewer/?uri=github.com/leonkrix/leonkrix.dev)
[![Live](https://img.shields.io/badge/live-leonkrix.dev-4f8cff)](https://leonkrix.dev)
[![License](https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey)](LICENSE)

Personal portfolio. A minimal, dark, fast and privacy-friendly static site: no cookies, no trackers, no third-party scripts or fonts.

**Live: <https://leonkrix.dev>**

## Tech stack

- [Astro](https://astro.build) (static output), TypeScript (strict), Tailwind CSS v4, React islands where needed
- Content as typed YAML (projects, experience) validated with Zod at build time
- Hosted on Cloudflare (Git integration), every change goes through a pull request

## Quality gates

Nothing reaches `main` without a green `CI passed` check (enforced by a repository ruleset):

| Check               | What it covers                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Lint, format, types | ESLint (typescript-eslint strict), Prettier, `astro check`                               |
| Unit tests          | Vitest                                                                                   |
| Build-output checks | Metadata, legal pages, links and anchors, security headers, CSP, contact data protection |
| End-to-end tests    | Playwright (desktop and mobile), privacy guard (same-origin only, no cookies), axe       |
| Lighthouse          | Every category at least 95 on mobile, size budgets, no third-party requests              |
| Security            | CodeQL, dependency review, `pnpm audit`, OpenSSF Scorecard, Dependabot, secret scanning  |
| Workflow lint       | `actionlint` for the workflow files, actions pinned to commit SHAs                       |

A pre-commit hook (Husky and lint-staged) formats and lints staged files and runs the type check and related unit tests when code is staged.

## Development

Requirements: Node (see `.nvmrc`) and pnpm (see `packageManager` in `package.json`).

```bash
pnpm install
pnpm dev          # local dev server
pnpm check        # the fast checks below, as in CI
pnpm test:e2e     # browser tests (first time: pnpm exec playwright install chromium)
pnpm lighthouse   # performance, accessibility, best practices and SEO budgets
```

| Script                 | Purpose                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm dev`             | Start the dev server                                                                           |
| `pnpm build`           | Production build to `dist/`                                                                    |
| `pnpm preview`         | Serve the production build                                                                     |
| `pnpm lint`            | ESLint (generates the Astro types first)                                                       |
| `pnpm format:check`    | Prettier check                                                                                 |
| `pnpm typecheck`       | `astro check` for the site and `tsc` for the Cloudflare Functions                              |
| `pnpm test`            | Unit tests (Vitest)                                                                            |
| `pnpm test:dist`       | Checks against the production build in `dist/`                                                 |
| `pnpm check`           | Lint, format check, types, unit tests, build and build-output checks                           |
| `pnpm test:e2e`        | Playwright end-to-end tests (builds first)                                                     |
| `pnpm lighthouse`      | Lighthouse quality gate (builds first, needs Chrome)                                           |
| `pnpm dev:functions`   | Build, then run site and Cloudflare Functions locally (Wrangler, port 8788), needs `.dev.vars` |
| `pnpm build:functions` | Check that the Cloudflare Functions bundle                                                     |

Copy `.env.example` to `.env` to try the Impressum address locally. Real values are never committed; in production they are Cloudflare build variables.

## Project structure

```text
src/
  components/   Astro components (header, hero, cards, icons, ...)
  content/      Projects and experience as YAML (validated by src/lib schemas)
  layouts/      Base and legal page layouts
  lib/          Plain TypeScript: schemas, helpers, site configuration, with unit tests
  pages/        Routes: home, Impressum, Datenschutz, 404, sitemap
  styles/       Design tokens and global styles
functions/      Cloudflare Pages Functions (contact form API) with their own tsconfig
public/         robots.txt, favicon, security headers (_headers)
tests/          Build-output checks (Vitest) and end-to-end tests (Playwright)
scripts/        Lighthouse quality gate
.github/        CI, CodeQL, security workflows and Dependabot
```

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

All rights reserved. See [LICENSE](LICENSE).
