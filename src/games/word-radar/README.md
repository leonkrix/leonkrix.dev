# Word Radar

A word is hidden. Guess words, and the game tells you how close each one is in **meaning** as a rank out of about 30,000 common English words. In the style of the well-known word similarity games, with our own name, look and texts. This is the game that talks about the machine learning side of the site.

## Rules

- The game hides an everyday word (an animal, an object, a food, a plant, a part of the body, a material). You type any word. The answer is its **rank**: 1 is the hidden word, 2 the word that is nearest to it in meaning, and so on up to about 30,000. A lower rank is better.
- Only words from the game's list are accepted (about 30,000 common English words, no names, no little words such as "the"). A word that is not in the list, a word that was tried before and anything that is not one word of letters is refused with a message and costs nothing.
- **How close** is also said in words, never by color alone: Found it (rank 1), Burning (2 to 10), Hot (11 to 100), Warm (101 to 1,000), Cool (1,001 to 5,000), Cold (above).
- **The radar** shows the guesses as dots around the hidden word in the middle. The distance from the middle is a logarithm of the rank (rings at rank 10, 100, 1,000 and 10,000), the direction comes from how the word differs from the hidden word (see below). The best guesses and the newest one are written next to their dot. A beam with a fading tail turns round the picture once in five seconds, and every dot flashes at the moment the beam passes it. The newest dot pops up and sends out a ring.
- **The list** sorts the guesses by rank, with a bar, the rank and the label. The newest guess is also pinned above the list.
- **Hint:** a word that is closer than the best guess so far, at about half of its rank (rank 2,000, 1,000, 500, 250 and so on down to 2: small steps, so that a round lasts; a data test checks the steps). The first hint starts from rank 4,000 at the most. It is marked "hint" and counted. Never the hidden word.
- **Give up** asks twice ("Really give up?", the question goes away after four seconds) and shows the word.
- **When the round is over** the radar becomes a **map** (the hidden word, the guesses joined in the order they were made, and the nearest words) and the list shows the 40 **nearest words** (your own guesses marked). The two switches above the panels can show the radar and the guesses again.
- Unlimited rounds, no daily word, nothing saved (see the site-wide storage rule in `CLAUDE.md`).

The address can prepare a round: `?seed=anything`. The same seed always hides the same word (the end-to-end tests use this). Digits are the seed itself (that is what the link of the game contains), any other text is turned into a seed.

The page reserves the space of everything that appears later (the message, the newest guess, the result), and the list scrolls inside a box of fixed height, so **nothing on the page moves** while you play. Every browser test watches the layout on every frame (the generic layout guard, `tests/e2e/layout-guard.ts`); the tests of this game play a full round on desktop and phone and give up on a 320 pixel wide screen.

## Design decisions

- **Logic and interface are separate.** `logic/` is pure TypeScript without DOM and React: `data.ts` (the three files as one structure), `similarity.ts` (cosine similarity and the ranking of all words), `round.ts` (the round as an immutable value: guesses, hints, giving up), `radar.ts` (buckets, distance and direction on the radar), `map.ts` (the principal plane of some words, and the map after a round), `link.ts` (the seed in the address). `components/` only draws.
- **The rank is computed at the start of a round**: the hidden word is compared with all 30,000 words (a dot product of 64 numbers each, about two million multiplications) and the words are sorted. That takes a few milliseconds, after which every guess is a lookup.
- **The data is fetched when the page opens** (about 2 MB: `data/vocabulary.txt`, `data/vectors.bin`, `data/secrets.txt`, imported with `?url` so that they are files with a fingerprint and cached for good). A small script of the game page starts the fetch as soon as the page has loaded, in parallel with React; the fetch has **low priority**, otherwise Lighthouse counts the 2 MB as part of the first paint (score 73 instead of 98, measured 2026-10-13); the game shows a loading line until the data is there. The page budget in `GAME_BUDGETS` is accordingly large (total 2.6 MB), the scripts are 78 KB.
- **The direction on the radar comes from the neighborhood of the hidden word.** At the start of a round the 300 words that are nearest to the hidden word are analysed (a principal component analysis in the browser, `logic/radar.ts` and `logic/map.ts`): the two directions in which these words differ most span the plane of the radar. The angle of a guess is the direction of its difference to the hidden word seen on that plane. So words that are related to the hidden word in similar ways (for the hidden word "volcano": a word about eruptions and a word about lava versus a word about tourism) tend to lie in similar directions, and so near each other. It is a flat picture of a 64 dimensional space, so it is only a tendency, never a promise, and the plane does not change while you play (a dot keeps its direction). The distance is the information that matters; the direction is for orientation. The map after the round is a principal component analysis of the words of that round (your guesses and the nearest words), a truer picture.
- **The page is as high before the game as after it.** The page shows `WordRadarSkeleton` (the same boxes as the game, empty and without function) on the server while the game loads, and the game shows it while the words are fetched. See "Layout" in `src/games/README.md`.
- **The hidden words are everyday things** (`scripts/word-radar/select.ts`): only nouns whose most common sense is an animal, an artifact, a part of the body, a food, an object, a natural phenomenon, a plant or a substance, that are among the 20,000 commonest words, have 3 to 10 letters, are no names and were found in a text collection. Whole categories with abstract or sensitive words (people, acts, feelings, ideas) are left out, which keeps the list free of offensive words without a long blacklist. A short list of words that slip through anyway (vague words such as "world" or "piece", names, drugs, weapons, body fluids) is in `scripts/word-radar/blocked-secrets.txt`; a data test checks that none is hidden.
- **Not color alone.** Every row has the bucket as a word, the rank as a number and a bar; the radar is decorative (`aria-hidden`) and everything it shows is in the list. The result of a guess is announced through a live region. Both lists can be scrolled with the keyboard.
- **Animation is CSS only:** a slow sweep on the radar, a pop and a ring for a new dot, a burst when the word is found, the bars grow, the result slides in. With reduced motion nothing moves (the sweep is hidden).

## Data (sources and licenses)

The numbers are **GloVe** word vectors (6B tokens, 100 dimensions; Pennington, Socher and Manning, Stanford University; Public Domain Dedication and License) and the choice of the words uses **WordNet 3.0** (Princeton University; WordNet License, the notice is in `THIRD_PARTY.md`). Both are credited there. The downloads are not in the repository (`data-raw/`, ignored by git); the result is.

### Making the data again

You only need this to change the data (more words, another size, another filter). Everything else works with the files in the repository.

1. Download `glove.6B.zip` (862 MB) from <https://downloads.cs.stanford.edu/nlp/data/glove.6B.zip> and unpack `glove.6B.100d.txt` into `data-raw/word-radar/`: `tar -xf glove.6B.zip -C data-raw/word-radar glove.6B.100d.txt`.
2. Download `WNdb-3.0.tar.gz` (10 MB) from <https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz> and unpack it into `data-raw/word-radar/wordnet/` (so that `data-raw/word-radar/wordnet/dict/index.noun` exists): `tar -xzf WNdb-3.0.tar.gz -C data-raw/word-radar/wordnet`.
3. Run `pnpm word-radar-data` (about two seconds). It prints what it did.

What the script (`scripts/word-radar/build-data.ts`) does: it reads GloVe from the top (the file is sorted by how common a word is) and keeps the words that are ordinary lower case words in WordNet (the part of speech does not matter, names are left out) and no stop words, until there are 30,000. It shrinks the vectors from 100 to 64 numbers with a **principal component analysis** (`pca.ts`: the covariance matrix and Jacobi rotations; 64 directions keep 82.5 percent of the variation), makes every vector one unit long (so that a dot product is the cosine similarity) and stores each number as a whole number from -127 to 127 (one byte). Then it chooses the hidden words. Same input, same output: the files are only changed when the script, the list of blocked words or the downloads change.

## How to change what can be hidden

Add the word to `scripts/word-radar/blocked-secrets.txt` (one or more words per line, lines with `#` are comments) and run `pnpm word-radar-data`. The word stays a valid guess; it can only no longer be hidden.

## Tests

- `scripts/word-radar/pca.test.ts`, `wordnet.test.ts`: the principal component analysis (eigenvalues of a known matrix, the strongest direction of a tilted line, distances kept), reading WordNet files (from a sample in the real format), choosing words (names, stop words, abstract nouns, the blocklist).
- `logic/logic.test.ts`: decoding and unit length, cosine similarity and ranking, a round (rank of a guess, unknown, repeated and invalid words, winning), hints (always closer, never the hidden word, they run out), giving up, the nearest words, the radar (buckets, distance, stable direction), the map (a square from -1 to 1, similar words together), the seed in the address.
- `data/data.test.ts`: the real data (30,000 different lower case words, no little words, the right size of the number file, enough hidden words that are in the list and not blocked) and the **meaning in the numbers**: king is closer to queen than to banana, dog to cat than to car, the nearest words of volcano contain eruption and lava, and so on.
- `tests/e2e/word-radar.spec.ts`: the game in the browser (the rank of a guess equals the one from the data, sorting, refusals, hints, winning with the map and the nearest words, giving up, keyboard, the same word from the link, **no layout shift** in a round and on a 320 pixel screen, nothing stored, axe during play and at the end, reduced motion).
