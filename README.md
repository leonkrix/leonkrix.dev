# leonkrix.dev

Personal portfolio of Leon Krix, Software Engineer. Live at <https://leonkrix.dev>.

Built with Astro, TypeScript, React islands and Tailwind CSS. Static site, hosted on Cloudflare.

## Development

Requirements: Node (see `.nvmrc`) and pnpm (see `packageManager` in `package.json`).

```bash
pnpm install
pnpm dev        # local dev server
pnpm check      # lint + format check + typecheck + tests + build (same as CI)
```

| Script              | Purpose                     |
| ------------------- | --------------------------- |
| `pnpm dev`          | Start the dev server        |
| `pnpm build`        | Production build to `dist/` |
| `pnpm preview`      | Serve the production build  |
| `pnpm lint`         | ESLint                      |
| `pnpm format:check` | Prettier check              |
| `pnpm typecheck`    | `astro check` (TypeScript)  |
| `pnpm test`         | Unit tests (Vitest)         |
| `pnpm check`        | Everything above, as in CI  |

Project conventions and the roadmap live in [CLAUDE.md](CLAUDE.md) and [PLAN.md](PLAN.md).

## License

All rights reserved. See [LICENSE](LICENSE).
