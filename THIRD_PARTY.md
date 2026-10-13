# Third-party material

The code, texts, images and design of this website are all rights reserved (see [LICENSE](LICENSE)). The following third-party material is used under its own license. Everything is served from our own origin, nothing is loaded from a third-party server.

## Fonts

| Font                                                                                           | Use          | License |
| ---------------------------------------------------------------------------------------------- | ------------ | ------- |
| [Inter](https://rsms.me/inter/) via `@fontsource-variable/inter`                               | Text         | OFL-1.1 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) via `@fontsource-variable/jetbrains-mono` | Code, labels | OFL-1.1 |

## Icons

| Icon set                                                                 | Use                                                                                                          | License |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------- |
| [Lucide](https://lucide.dev) via `@iconify-json/lucide`                  | General symbols, and the pictures of the objects in Root Cause (`src/games/root-cause/data/object-icons.ts`) | ISC     |
| [Simple Icons](https://simpleicons.org) via `@iconify-json/simple-icons` | Brand icons (GitHub, ...)                                                                                    | CC0-1.0 |

The icons are inlined as SVG at build time (the object pictures of Root Cause are copied from the same package into a data file, so that the game needs no icon set at run time). A rug, a sofa, a desk and a cable tray in Root Cause are our own drawings. Brand icons only mark links to the respective service; the brands belong to their owners.

## Libraries

Runtime and development dependencies are listed in `package.json` and `pnpm-lock.yaml`, each under its own license (checked by dependency review in CI).

## Games (Playground)

Game data (word lists, definitions, level files, word vectors) is listed here with its source and license before a game goes live.

| Data                                                                 | Source                                                                         | License                                        | Used in                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------- |
| Tech term lists (3, 4 and 5 letters) with categories and definitions | Original work written for this site                                            | All rights reserved, like the rest of the site | Tech Words (`src/games/tech-words/data/`) |
| Levels, titles, stories, names, room and object words, clue texts    | Original work written for this site (the levels are made by our own generator) | All rights reserved, like the rest of the site | Root Cause (`src/games/root-cause/data/`) |
| About 240 topics with more than 3,000 terms and definitions          | Original work written for this site                                            | All rights reserved, like the rest of the site | Link Up (`src/games/link-up/data/`)       |

### Word Radar: GloVe and WordNet

The data of Word Radar (`src/games/word-radar/data/`) is made from two public data sets by the script `scripts/word-radar/build-data.ts` (`pnpm word-radar-data`). The downloads themselves are never committed (folder `data-raw/`, ignored by git); what is committed is the result.

| Data                                                                                            | Source                                                                                                                                          | License                                          | Used in                                   |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| `vocabulary.txt`, `vectors.bin`: 30,000 words and their numbers, reduced from 100 to 64 numbers | GloVe 6B word vectors (Jeffrey Pennington, Richard Socher, Christopher D. Manning, Stanford University, 2014), chosen and filtered with WordNet | Public Domain Dedication and License v1.0 (PDDL) | Word Radar (`src/games/word-radar/data/`) |
| `secrets.txt`: the words that can be hidden, and which words count as ordinary words            | WordNet 3.0 (Princeton University), plus our own list of words that must not be hidden (`scripts/word-radar/blocked-secrets.txt`)               | WordNet License (below)                          | Word Radar                                |

GloVe: Pennington, J., Socher, R., Manning, C. D. (2014), "GloVe: Global Vectors for Word Representation", <https://nlp.stanford.edu/projects/glove/>. The vectors are free to use, also commercially, under the PDDL; the numbers in this repository are a changed copy (the 30,000 most common words that WordNet knows, reduced by a principal component analysis and rounded to whole numbers).

The WordNet license requires that its notice appears with every copy, including changed ones, so here it is. Only the words (not the senses or definitions) of WordNet are used, to decide which words are ordinary words and which words can be hidden.

> WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.
>
> THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED. BY WAY OF EXAMPLE, BUT NOT LIMITATION, PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF MERCHANTABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER RIGHTS.
>
> The name of Princeton University or Princeton may not be used in advertising or publicity pertaining to distribution of the software and/or database. Title to copyright in this software, database and any associated documentation shall at all times remain with Princeton University and LICENSEE agrees to preserve same.

Permission to use, copy, modify and distribute the software and database and its documentation for any purpose and without fee or royalty is granted by Princeton University, provided that the copyright notice and statements above, including the disclaimer, appear on all copies. Source: <https://wordnet.princeton.edu/license-and-commercial-use>.
