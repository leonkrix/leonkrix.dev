# Games (Playground)

The games of the Playground section.

## How it fits together

- `registry.ts` lists every game (slug, name, tag, description, icon, `status`). A game is merged as `hidden` and set to `live` in the pull request that completes it. A hidden game with a `GamePage.astro` still gets its page in the dev server (`pnpm dev`, never in a build), so it can be played while it is built. Only live games get a page, a tile, a navigation entry and a sitemap entry. With no live game the site looks as if the Playground did not exist.
- `shared/` holds what several games use: seeded random numbers (`random.ts`, reproducible rounds and generators) and the tech vocabulary type (`tech-term.ts`).
- `<slug>/` is one game (see below).
- The pages come from `src/pages/games/[...slug].astro` (overview and one page per live game), the home page section from `src/components/games/Playground.astro`, the page frame from `src/layouts/GameLayout.astro` (title, the game, and the panels "How to play", "Keyboard" and "How it is built" as native `<details>`, no script needed).

## A game folder

```text
src/games/<slug>/
  README.md        rules, design decisions, data sources and licenses, how to add words or levels, how to test
  GamePage.astro   the page: <GameLayout game={game}> with the game (React island) and the panel texts as slots
  Preview.astro    the animated tile preview (pure CSS and SVG, mark moving parts with class "anim")
  logic/           pure TypeScript: no DOM, no React, no browser storage, unit tested
  data/            word lists, levels, vectors (with data tests)
  components/      React components of the island
```

`GamePage.astro` and `Preview.astro` are found by name, there is nothing to register besides the entry in `registry.ts`. A test checks that every live game has `GamePage.astro`, `Preview.astro` and `README.md`, and that every folder has a registry entry.

## Rules in short

- English only, unlimited play, no daily mode, **nothing stored on the device** (no cookies, `localStorage`, `sessionStorage`, IndexedDB, cache storage). The site-wide storage guard fails the build otherwise.
- Own names, own art, own texts. Data sources go into [THIRD_PARTY.md](../../THIRD_PARTY.md) with their license.
- Keyboard playable, results announced to screen readers, never color alone, reduced motion honored.
- The home page loads no game JavaScript. A game page loads React and its data on its own page only.
- Before a game goes live:
  1. set its budget in `GAME_BUDGETS` in `scripts/lighthouse.mjs` (measure first, `pnpm lighthouse` fails without an entry),
  2. add its page to the live check (`scripts/live-check.ts`),
  3. update the portfolio (technologies, the website project entry, About text) and THIRD_PARTY.md,
  4. run `pnpm check`, `pnpm test:e2e` and `pnpm lighthouse`.

## README template for a game

```markdown
# <Name>

One sentence: what the game is.

## Rules

## Design decisions

## Data (sources and licenses)

## How to add words or levels

## Tests
```
