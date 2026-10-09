# Third-party material

The code, texts, images and design of this website are all rights reserved (see [LICENSE](LICENSE)). The following third-party material is used under its own license. Everything is served from our own origin, nothing is loaded from a third-party server.

## Fonts

| Font                                                                                           | Use          | License |
| ---------------------------------------------------------------------------------------------- | ------------ | ------- |
| [Inter](https://rsms.me/inter/) via `@fontsource-variable/inter`                               | Text         | OFL-1.1 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) via `@fontsource-variable/jetbrains-mono` | Code, labels | OFL-1.1 |

## Icons

| Icon set                                                                 | Use                       | License |
| ------------------------------------------------------------------------ | ------------------------- | ------- |
| [Lucide](https://lucide.dev) via `@iconify-json/lucide`                  | General symbols           | ISC     |
| [Simple Icons](https://simpleicons.org) via `@iconify-json/simple-icons` | Brand icons (GitHub, ...) | CC0-1.0 |

The icons are inlined as SVG at build time. Brand icons only mark links to the respective service; the brands belong to their owners.

## Libraries

Runtime and development dependencies are listed in `package.json` and `pnpm-lock.yaml`, each under its own license (checked by dependency review in CI).

## Games (Playground)

Game data (word lists, definitions, level files, word vectors) is listed here with its source and license before a game goes live.

| Data                                                                 | Source                              | License                                        | Used in                                   |
| -------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Tech term lists (3, 4 and 5 letters) with categories and definitions | Original work written for this site | All rights reserved, like the rest of the site | Tech Words (`src/games/tech-words/data/`) |

Planned sources: the term lists are reused by Link Up, and the levels of Root Cause are original work written for this site. Word Radar will use GloVe word vectors (Pennington, Socher, Manning, Stanford, Public Domain Dedication and License v1.0) and a list of nouns derived from WordNet (Princeton University, WordNet License); both are credited here when they are added.
