# Tech Words

Guess the hidden tech term in six tries. Like the well-known word game, but the words are tech terms (languages, tools, protocols, hardware, security and more), with a definition after every round.

## Rules

- A round has a hidden term of **3, 4 or 5 letters** (chosen by the player) and six tries. An optional **category** limits the terms that can be hidden (languages, web, data, networking, hardware, operating systems, security, DevOps, machine learning, computer science).
- Only terms **from our own list** are accepted as guesses. Any other word shakes the row and does not cost a try. The list for a length is also the list of possible answers, so every guess is something the game knows.
- After a guess every tile shows: **correct** (green, check mark: right letter, right place), **present** (amber, circle: the letter is in the term, elsewhere), **absent** (grey, cross: no unused copy of the letter is left). Repeated letters are counted: correct tiles are handed out first, then present tiles from left to right, and a letter is only marked as often as it appears in the term.
- Letters known to be absent are greyed out on the on-screen keyboard. A letter keeps the best result seen so far (correct, then present, then absent).
- When the round ends the term, its category and its definition are shown. The result can be copied as colored squares.
- Unlimited rounds, no daily word, nothing saved (see the site-wide storage rule in `CLAUDE.md`).

The address can prepare a round: `?length=4`, `?category=security`, `?seed=anything`. The same setup always picks the same term (the end-to-end tests use this). A seed made of digits is the seed itself, any other text is turned into a seed. **The link in a copied result contains all three** (for example `?length=4&category=networking&seed=1234567890`), so whoever receives a result can play exactly that puzzle at once. `logic/link.ts` reads and writes these addresses and is unit tested, including the round trip.

## Design decisions

- **Logic and interface are separate.** `logic/` is pure TypeScript without DOM and React: `evaluate.ts` (the result of a guess), `keyboard.ts` (letter states), `round.ts` (the round as an immutable value and the actions on it), `select.ts` (lengths, categories, picking the term from a seeded random generator), `share.ts` (the result text), `link.ts` (the address of a puzzle). `components/` only draws.
- **One list per length, loaded on demand.** `data/terms-3.ts`, `terms-4.ts` and `terms-5.ts` are separate chunks, loaded through `data/index.ts` when the player starts that length.
- **The focus never stays on a button after a click.** Pressing Enter on a focused button would press it again (starting a new round in the middle of a game). The on-screen keys do not take the focus on pointer down, and "New round" moves the focus to the board.
- **Not color alone.** Correct, present and absent tiles carry a mark in the corner and an accessible label (for example "E, elsewhere"); a handed-in row is also announced through a live region.
- **Animation is CSS only:** pop when typing, flip with a color change in the middle, shake for a refused row, a hop for the winning row, a slide-in for the result. With reduced motion everything is instant.

## Data (sources and licenses)

All terms and definitions are original work written for this site (see `THIRD_PARTY.md`). Product and technology names appear only as plain names, without logos and without claiming any connection. Definitions are in our own words.

## How to add words

Add an entry to the file of its length in `data/` (`terms-3.ts`, `terms-4.ts` or `terms-5.ts`), in the form `['term', 'category', 'Definition.']`, **in its place**: the files are sorted by category (in the order of the list in `shared/tech-term.ts`) and then alphabetically, and a test fails if they are not:

- the term is lowercase letters a to z and has the length of its list;
- the category is one of the ten in `shared/tech-term.ts`;
- the definition is one sentence of at most 100 characters, starts with a capital letter, ends with a period, is written in our own words and does not contain the term itself.

`pnpm test` checks all of this, including duplicates, enough terms per category and length, and a short list of words that must never appear. Every category needs at least five terms for each length so that the category filter works.

## Tests

- `logic/logic.test.ts`: evaluation with repeated letters (the tricky cases), keyboard states, the round from the first letter to a won or lost game, picking terms, the share text.
- `data/data.test.ts`: every list (counts, format, order, uniqueness, categories, definitions), the loader and the example shown in the tile of the game (`preview-words.ts`).
- `tests/e2e/tech-words.spec.ts`: a full round with the keyboard in the browser, refused words, the length switch, accessibility (axe) and reduced motion.
