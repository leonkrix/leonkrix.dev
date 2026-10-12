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

Planned sources: Word Radar will use GloVe word vectors (Pennington, Socher, Manning, Stanford, Public Domain Dedication and License v1.0) and a list of nouns derived from WordNet (Princeton University, WordNet License); both are credited here when they are added.
