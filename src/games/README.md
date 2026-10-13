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
  Preview.astro    the animated tile preview (pure CSS and SVG; the best ones play a short version of the game itself, see the previews of Link Up and Root Cause)
  logic/           pure TypeScript: no DOM, no React, no browser storage, unit tested
  data/            word lists, levels, vectors (with data tests)
  components/      React components of the island
```

`GamePage.astro` and `Preview.astro` are found by name, there is nothing to register besides the entry in `registry.ts`. A test checks that every live game has `GamePage.astro`, `Preview.astro` and `README.md`, and that every folder has a registry entry.

## Rules in short

- English only, unlimited play, no daily mode, **nothing stored on the device** (no cookies, `localStorage`, `sessionStorage`, IndexedDB, cache storage). The site-wide storage guard fails the build otherwise.
- Own names, own art, own texts. Data sources go into [THIRD_PARTY.md](../../THIRD_PARTY.md) with their license.
- Keyboard playable, results announced to screen readers, never color alone, reduced motion honored.
- The home page loads no game JavaScript. A game page loads React and its data on its own page only. Big data is split into files that are fetched when they are needed (Link Up: only the files of the four categories of a puzzle).
- **Nothing on a page may ever move** when something appears, changes or loads (see "Layout" below).
- Before a game goes live:
  1. set its budget in `GAME_BUDGETS` in `scripts/lighthouse.mjs` (measure first, `pnpm lighthouse` fails without an entry),
  2. check the live check: it reads the game pages from the sitemap by itself, so extend `scripts/live-check.ts` only if the game needs more (an API, a special header),
  3. update the portfolio (technologies, the website project entry, About text) and THIRD_PARTY.md,
  4. run `pnpm check`, `pnpm test:e2e` and `pnpm lighthouse`.

## Layout: nothing moves

Every browser test runs with the **layout guard** (`tests/e2e/layout-guard.ts`, switched on in `tests/e2e/fixtures.ts` for every test of every page): from the moment the page has loaded, it looks at every element on every frame and fails the test when an element that was already there changes its place on the page, and when the page changes its height. So everything that appears later (a message, a result, a list that fills, the game itself) must have its space reserved. How this is done in a game:

- **A skeleton.** The game page renders, on the server, a picture of the game before it has started: the same boxes (field, bars, tiles, buttons, space for results), empty and without function (`<Name>Skeleton.tsx`, put into the `fallback` slot of the island in `GamePage.astro`). The game shows the same skeleton while its data loads. Since the CSS is the same, the page is exactly as high before the game as after it, at every width. If the real game gets another box, the skeleton needs it too: the guard finds out when they differ. (A skeleton must not import code that needs the browser at load time, such as a Web Worker: use `import type` for types.)
- **Reserved space** for everything that appears during play (`min-height` for messages and results, a fixed-height box that scrolls for a list that grows).
- **`data-layout-fluid`** marks a box whose inner parts are meant to rearrange (the tiles of a board, a list of words, the clues that move when they are ticked): the box itself must keep its place, what is inside is not watched. Use it sparingly.
- What the visitor asks for is not a surprise: the guard measures anew after a resize, after a `<details>` was opened and after a change of the address (also by `history.pushState`). A game that is opened with a prepared state in its address (a level) starts at another height than its skeleton: tests open such a state from the start page instead, like a player does.
- **Wait for the game** in tests with `gameReady(page)` (from `fixtures.ts`) before using it: until the game has taken over, the skeleton only looks like it.
- A test that changes a page on purpose can switch the guard off with `test.use({ layoutGuard: false })` and a comment that says why (a build-output test insists on the comment; nothing uses it so far). What is not visible (`visibility: hidden`, `display: none`) is not watched, so something can lie invisibly on top of something else and take its place (the confirmation of the contact form lies on the form).
- Every page of the site is in `tests/e2e/pages.ts`, and `tests/e2e/layout.spec.ts` opens each one and reads it to the end. A new page is only missing from that list when the build-output test `e2e-coverage.test.ts` says so; add it there.

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
