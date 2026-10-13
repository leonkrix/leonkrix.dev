import { describe, expect, it } from 'vitest';

import { chooseSecrets, isStopWord, isVocabularyWord } from './select';
import { parseIndex, parseNounData, readWordNet } from './wordnet';

// A few lines in the format of the files of WordNet 3.0 (the license text at the top starts with spaces)
const indexNoun = [
  '  1 This software and database is being provided to you',
  'dog n 7 5 @ ~ #m #p %p 7 4 02086723 10133013 10042764 09905672 07692347 03907626 02712903',
  'london n 2 3 @ #p ~ 2 0 08909000 08911600',
  'turkey n 3 3 @ #m ~ 3 1 01794158 07847813 08882000',
  'apple n 2 3 @ #m ~ 2 1 07739125 12633638',
  'idea n 1 2 @ ~ 1 5 05842164',
  'new_york n 1 1 @ 1 0 08940000',
  'cat n 1 1 @ 1 3 02121620',
].join('\n');
const dataNoun = [
  '  1 This software and database is being provided to you',
  '02086723 05 n 02 dog 0 domestic_dog 0 001 @ 02085998 n 0000 | a member of the genus Canis',
  '08909000 15 n 01 London 0 001 @ 08000000 n 0000 | the capital of the United Kingdom',
  '01794158 05 n 02 turkey 0 Meleagris_gallopavo 0 001 @ 01793000 n 0000 | large gallinaceous bird',
  '07739125 13 n 02 apple 0 orchard_apple_tree 0 001 @ 07738000 n 0000 | fruit',
  '05842164 09 n 01 idea 0 001 @ 05841000 n 0000 | a personal view',
  '02121620 05 n 01 cat 0 001 @ 02120000 n 0000 | feline mammal',
].join('\n');
const indexVerb = 'run v 41 4 @ ~ $ + 41 33 01926311';
const wordnet = readWordNet({ indexNoun, indexVerb, indexAdj: '', indexAdv: '', dataNoun });

describe('reading WordNet', () => {
  it('reads the senses of a word from the index', () => {
    const entries = parseIndex(indexNoun);
    expect(entries.map((entry) => entry.word)).toEqual([
      'dog',
      'london',
      'turkey',
      'apple',
      'idea',
      'new_york',
      'cat',
    ]);
    expect(entries.find((entry) => entry.word === 'dog')).toEqual({
      word: 'dog',
      tagged: 4,
      first: '02086723',
    });
  });

  it('reads the kind and the forms of a sense from the data', () => {
    const senses = parseNounData(dataNoun);
    expect(senses.get('02086723')).toEqual({ kind: 5, forms: ['dog', 'domestic_dog'] });
    expect(senses.get('08909000')?.forms).toEqual(['London']);
  });

  it('keeps ordinary words, and leaves out names and words of several parts', () => {
    expect(wordnet.words.has('dog')).toBe(true);
    expect(wordnet.words.has('run')).toBe(true);
    expect(wordnet.words.has('london')).toBe(false);
    expect(wordnet.words.has('new_york')).toBe(false);
  });
});

describe('choosing the words of the game', () => {
  it('accepts lower case words that WordNet knows and that are no stop words', () => {
    expect(isVocabularyWord('dog', wordnet)).toBe(true);
    expect(isVocabularyWord('run', wordnet)).toBe(true);
    expect(isVocabularyWord('the', wordnet)).toBe(false);
    expect(isStopWord('the')).toBe(true);
    expect(isVocabularyWord('london', wordnet)).toBe(false);
    expect(isVocabularyWord('x', wordnet)).toBe(false);
    expect(isVocabularyWord('Dog', wordnet)).toBe(false);
  });

  it('hides only common everyday things', () => {
    const vocabulary = ['dog', 'run', 'idea', 'cat', 'apple', 'turkey'];
    // idea is an abstract kind and run is no noun
    expect(chooseSecrets(vocabulary, wordnet)).toEqual(['dog', 'cat', 'apple', 'turkey']);
  });

  it('leaves out blocked words, and stops at the wanted count', () => {
    const vocabulary = ['dog', 'cat', 'apple', 'turkey'];
    expect(chooseSecrets(vocabulary, wordnet, new Set(['cat']))).toEqual([
      'dog',
      'apple',
      'turkey',
    ]);
    expect(chooseSecrets(vocabulary, wordnet, new Set(), 2)).toEqual(['dog', 'cat']);
  });
});
