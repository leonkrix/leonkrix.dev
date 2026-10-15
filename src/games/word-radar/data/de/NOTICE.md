# Data of the German Word Radar

The files in this folder (`vocabulary.txt`, `vectors.bin`, `secrets.txt`, `forms.txt`) are made by
`scripts/word-radar/build-data-de.ts` (`pnpm word-radar-data-de`) from four public data sets. They
are **not** all rights reserved like the rest of this repository: they are shared under the
**Creative Commons Attribution-ShareAlike 4.0 International License** (CC BY-SA 4.0,
<https://creativecommons.org/licenses/by-sa/4.0/>), because two of the sources require it. The code
that makes them and everything else in this repository stays under the licence in `LICENSE`.

## What is in the files, and where it comes from

| File                                                                     | Made from                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vocabulary.txt`: 30,000 words                                           | The commonest words of the vectors below that are words of OdeNet or have a page in the German Wiktionary and are no form of another word                                                        |
| `forms.txt`: inflected forms                                             | The forms of these words (Hunde, Hundes for Hund) that appear in the vectors, made by endings and checked by the numbers                                                                         |
| `vectors.bin`: 64 numbers per word                                       | The word vectors below, reduced from 100 to 64 numbers by a principal component analysis and rounded to whole numbers                                                                            |
| `secrets.txt`: the words to be hidden, with the words that mean the same | The words of `vocabulary.txt` that are nouns for everyday things, chosen with OdeNet and our own examples, minus a list of words; the synonyms are words of OdeNet that are close in the numbers |

## Sources

- **Word vectors**: NLPL word embeddings repository, model 45 (German, trained on the German CoNLL17
  corpus, Word2Vec Continuous Skipgram, 100 dimensions). Licence **CC BY 4.0**. Fares, Murhaf;
  Kutuzov, Andrei; Oepen, Stephan and Velldal, Erik (2017): "Word vectors, reuse, and replicability:
  Towards a community repository of large-text resources", Proceedings of the 21st Nordic Conference
  on Computational Linguistics (NoDaLiDa). <http://vectors.nlpl.eu/repository/> (model 45).
- **OdeNet**, the Open German WordNet, version 1.4. Licence **CC BY-SA 4.0**. Siegel, Melanie and
  Bond, Francis (2021): "OdeNet: Compiling a German Wordnet from other Resources", Proceedings of
  the 11th Global Wordnet Conference. <https://github.com/hdaSprachtechnologie/odenet>. Used for
  the words, their parts of speech and the kind of thing a noun stands for.
- **German Wiktionary**, the list of the page titles (`dewiktionary-latest-all-titles-in-ns0`,
  October 2026). Licence **CC BY-SA 4.0** and GFDL. <https://de.wiktionary.org>, the authors are
  the contributors of the German Wiktionary. Used to tell which words exist and how they are
  written (capital letters of nouns, inflected forms).
- **WordNet 3.0** (Princeton University) and **GloVe** (Stanford University), the data sets of the
  English game: used only to tell English words from German ones and to name the kind of a noun,
  nothing of them is in the files (see `THIRD_PARTY.md` for their licences).

## What was changed

The data was selected, filtered and reduced (see above); it is not a copy of any source. A list of
words that must not be hidden (`scripts/word-radar/blocked-secrets-de.txt`) and our own examples of
things (`scripts/word-radar/seeds-de.ts`) were added.

## What you may do with these files

Use, share and change them under CC BY-SA 4.0: give credit to the sources above, say that you
changed them, and share what you make of them under the same licence.
