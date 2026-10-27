# Link Up

Sixteen tech terms belong to four hidden groups of four. Pick four that you think belong together; the group is checked by itself. Like the well-known grouping game, with our own topics, names and art.

## Rules

- A puzzle has **16 tiles** (terms) and **4 groups of 4**. A group is one topic ("Sorting algorithms", "HTTP methods", "Git commands", ...). The player picks four tiles. The **fourth pick hands the group in by itself** (a quarter of a second later, so the pick is seen).
- **Correct:** the four tiles light up in a color, and the group appears as a bar at the top with its name and its terms. The remaining tiles move up (a short slide). The four colors are the colors of the site (blue, cyan, amber, green), handed out in the order the groups are found.
- **Wrong:** the tiles shake in red and one of **four tries** is used up (the dots above the board show how many are left). **One away:** if three of the four tiles belong together, the tiles hop in amber, a message says "One away!", and it still costs a try.
- **The same wrong group again costs nothing** ("You tried that already").
- **Out of tries:** the groups that were not found are shown one after the other (dashed bars), then the result.
- **A win** lights up the four bars one after the other and shows how many mistakes were made.
- **What a term means:** pointing at a tile, focusing it with the keyboard or tapping it shows its definition in the line under the board. The terms in the bars of the found groups can be asked, too.
- **The eye** next to the definition line blurs the definitions (a harder game) and shows them again. It is on at the start, it survives a new puzzle, and nothing is stored: a new visit starts with the definitions shown. With the eye off, the name of the term stays readable and the definition is hidden from screen readers, too.
- Buttons: **Shuffle** (the tiles that are left in a new order, with a slide), **Deselect all** (or the Esc key), **New puzzle**, **Copy link to this puzzle**.
- Unlimited rounds, no daily puzzle, nothing saved (a site-wide rule that tests enforce: nothing of the site is stored on the device).

The page reserves the space of everything that appears later (the result, the line with the definition, the bars of the found groups), so **nothing on the page moves** while you play. An end-to-end test watches the layout on every frame of a won game, a lost game and a game on a 320 pixel wide screen (position and size of the bar, the message, the board, the definition line, the result, the buttons and the whole page, with the eye used and definitions of all lengths) and fails when something moves by more than half a pixel. It was checked by removing a reserved space: the test then fails.

The address can prepare a puzzle: `?seed=anything`. The same seed always gives the same puzzle and the same first order (the end-to-end tests use this). Digits are the seed itself (that is what the link of the game contains), any other text is turned into a seed.

## Design decisions

- **Logic and interface are separate.** `logic/` is pure TypeScript without DOM and React: `puzzle.ts` (making a puzzle, counting solutions), `game.ts` (the game as an immutable value and the moves on it), `link.ts` (the seed in the address). `components/` only draws.
- **Every puzzle has exactly one solution, checked.** A term has exactly **one** category in the whole data (a test checks that no name is used twice). On top of that, a list of **conflicts** (`data/index.ts`) names pairs of categories that must never meet in one puzzle, because a term of one could pass for a term of the other: HTTP `DELETE` is also an SQL command, Clojure is also a functional language, a port number is also the service behind it, Dijkstra and Kruskal are also names of people. `generatePuzzle` picks four categories without a conflict and four terms of each, and then asks `countSolutions`, a **separate** function that counts every way to sort the 16 tiles into the four groups (a tile fits every group whose category lists a term with that name). It must find exactly one, or the puzzle is thrown away and another one is made. The tests run it on hundreds of seeds, and also check with a made-up pair of categories that share terms that it does see a second solution.
- **Auto-submit with the fourth pick.** One click less, and it is what was asked for. The short pause shows the pick; Esc and "Deselect all" put tiles back before that. A repeated wrong group costs nothing, so a misclick is not punished twice.
- **A reaction blocks the board** while it plays (a shake takes 0.6 s, a found group 0.8 s). The game state changes at the end of the reaction, so the animations always show the old state first and the new one afterwards.
- **The slide of the tiles is measured in the browser** (a small FLIP hook with the Web Animations API): the position of every tile before and after a change is compared, and a tile that moved glides from its old place. Everything else is CSS. With reduced motion there is no slide and no animation at all.
- **Not color alone.** A picked tile also lifts and is outlined; wrong and one-away tiles also move (shake, hop); found groups have the name of the group written on them; the mistakes are dots with a text for screen readers; everything that happens is announced through a live region.
- **Keyboard:** the board is one stop for the Tab key (roving tabindex), arrow keys move between the tiles, Space or Enter picks, Home and End jump, Esc puts everything back. The focus moves to the first tile when its tile leaves the board, and to the result when the game is over.
- **The home page loads no game code.** The tile on the Playground is `Preview.astro` (CSS only, about two and a half seconds: it plays the game itself. Sixteen grey tiles lie mixed up, four of a kind light up one after the other, take their color and glide into the next row, then the next group; the finished groups stay in the rows they went to and the tiles that are left move up, as in the game; it plays when the tile appears and again on hover). The game itself is a React island that is rendered in the browser only.
- **The data is fetched in pieces.** There are about 240 categories with more than 3,000 terms, a few hundred kilobytes. They live in fourteen files by topic (`data/categories-*.ts`), and a puzzle needs four categories, so the game fetches only the files of the four that were chosen (usually three or four files): `catalog.ts` (a list of every category with its file, small and part of the first script) is used to choose the categories, `shards.ts` holds the loaders, `load.ts` fetches and remembers the files, and `generatePuzzleLazily` makes exactly the puzzle that `generatePuzzle` would make from the same seed (a test checks this for 80 seeds). `data/index.ts` imports everything and is only used by tests and tools. A small script of the game page (`GamePage.astro`, `logic/first-game.ts`) starts the first puzzle as soon as the page has loaded, so the files with the words are fetched while React and the board are still loading; the game picks up the same promise. This keeps the Lighthouse score of the page at the level of the other games.

## Data (sources and licenses)

The topics, the terms and the definitions are original work written for this site (see `THIRD_PARTY.md`): about 240 topics with more than 3,000 terms: algorithms and theory, programming languages and frameworks, software engineering, the web (HTML, CSS, headers, browsers, accessibility, fonts), databases and cloud, networking and security, Linux and operating systems, hardware and electronics, machine learning and AI, and the people behind computing. The earlier idea to reuse the word lists of Tech Words was dropped: those are single words of three to five letters in ten broad categories, while Link Up needs fine topics with terms of any length. Where a term fitted, the idea came from there. Product and technology names appear only as plain names, without logos and without claiming any connection; definitions are in our own words.

## How to add topics or terms

The data is in `data/categories-*.ts` (by subject) as `{ id, name, description, terms: [['Name', 'Definition.'], ...] }`:

- `id`: lowercase words joined by hyphens, unique. `name` is the title of the group once it is found, `description` one sentence (at most 100 characters) about what the group has in common.
- A topic has **7 to 20 terms** (more is better where good terms exist; no filler, every term must clearly belong, and a topic with fewer good terms is fine). The pool needs at least 150 topics and an average of 11 terms. A term is shown on a tile: at most 18 characters, no line breaks. **No term may appear twice in the whole pool** (even in two topics), because the name is its identity.
- A definition is one sentence of at most 100 characters in our own words, ends with a period and does not contain the term as a whole word (a longer word that contains it, such as "headers" for HEAD, is fine).
- If a term of the new topic could also be taken for a term of an existing topic, add the pair to `conflicts` in `data/conflicts.ts` (typical cases: a family and its members, such as HTTP headers and security headers, Next.js and React frameworks, a person who also has a law or an algorithm named after them). Every topic must keep at least three partners that it may meet.
- A new topic goes into one of the `data/categories-*.ts` files (or a new file, which is added to `shards.ts` and `index.ts`). Then update the catalog: `pnpm exec vitest run src/games/link-up/data/catalog.test.ts -u` (the test fails with a diff until you do).

`pnpm test` checks all of this, and also that every topic is used by the generator and that a puzzle always has exactly one solution.

## Tests

- `data/catalog.test.ts`: the catalog matches the data (same topics in the same order, every topic in the file the catalog names, the loaders and the data know the same files).
- `data/data.test.ts`: at least 150 topics, 7 to 20 terms each, on average at least 11, unique ids and terms, the length of names and definitions, no term in its own definition, the conflict list (only existing topics, every topic has partners).
- `logic/puzzle.test.ts`: the lazy generator makes the same puzzle as the plain one and asks for four topics at a time; counting solutions (one, two for a made-up ambiguity, none for impossible data), puzzles (four groups of four, no conflicts, exactly one solution on 150 seeds, same seed same puzzle, all topics used).
- `logic/game.test.ts`: picking, correct and wrong groups, one away, the repeated group, winning, losing, revealing the missing groups, shuffling, the seed in the address.
- `tests/e2e/link-up.spec.ts`: a puzzle from a seed on a real page: definitions on hover and focus, correct and wrong groups, one away, a win and a new puzzle, losing and the missing groups, the keyboard, the same puzzle from the same link, no storage, axe (during play and at the end), a small screen, nothing moving on the page when the result appears, reduced motion (no animation at all).
