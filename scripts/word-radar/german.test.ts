import { describe, expect, it } from 'vitest';

import {
  chooseGermanSecrets,
  chooseGermanVocabulary,
  chooseSynonyms,
  englishWords,
  FORM_SIMILARITY,
  inflectedForms,
  isEverydayNoun,
  isGermanStopWord,
  lemmaTable,
  type Lexicon,
  odenetSpelling,
  spellingOf,
  thingScorer,
} from './german';
import { type Entry, type OdeNet } from './odenet';

/** A value that the test knows is there */
function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected a value');
  }
  return value;
}

const entry = (word: string, partOfSpeech: string, senses: string[] = []): Entry => ({
  word,
  partOfSpeech,
  basic: false,
  senses,
});

describe('inflectedForms', () => {
  it('makes the endings and umlaut plurals of a noun', () => {
    expect(inflectedForms('hund', 'n')).toEqual(
      expect.arrayContaining(['hunde', 'hunden', 'hundes']),
    );
    expect(inflectedForms('hand', 'n')).toEqual(expect.arrayContaining(['hände', 'händen']));
    expect(inflectedForms('haus', 'n')).toEqual(expect.arrayContaining(['häuser', 'häusern']));
    expect(inflectedForms('vater', 'n')).toContain('väter');
  });

  it('makes the declension and the comparison of an adjective', () => {
    expect(inflectedForms('schön', 'a')).toEqual(
      expect.arrayContaining(['schöne', 'schönen', 'schöner', 'schönere', 'schönsten']),
    );
  });

  it('makes the present, the past and the participle of a verb', () => {
    expect(inflectedForms('machen', 'v')).toEqual(
      expect.arrayContaining(['mache', 'machst', 'macht', 'machte', 'machten', 'gemacht']),
    );
    // too short to take apart
    expect(inflectedForms('tun', 'v')).toEqual([]);
  });

  it('only gives forms that are words of letters', () => {
    for (const form of (['n', 'a', 'v'] as const).flatMap((kind) =>
      inflectedForms('straße', kind),
    )) {
      expect(form).toMatch(/^[a-zäöüß]{3,25}$/);
    }
    expect(inflectedForms('wort', 'other')).toEqual([]);
  });
});

describe('stop words', () => {
  it('are little words, not words with a meaning', () => {
    for (const word of ['und', 'der', 'nicht', 'werden', 'können', 'zwischen']) {
      expect(isGermanStopWord(word), word).toBe(true);
    }
    for (const word of ['hund', 'haus', 'laufen', 'schön']) {
      expect(isGermanStopWord(word), word).toBe(false);
    }
  });
});

// Senses: 1 an animal (kind 5), 2 an idea (9), 3 a food (13), 4 a person (18)
const kinds = new Map([
  ['s1', 5],
  ['s2', 9],
  ['s3', 13],
  ['s4', 18],
]);

const odenet: OdeNet = {
  synsets: new Map(),
  entries: [
    entry('Hund', 'n', ['s1']),
    entry('Kunde', 'n', ['s4', 's2']),
    entry('Essen', 'n', ['s3']),
    entry('essen', 'v'),
    entry('schön', 'a'),
    entry('Idee', 'n', ['s2']),
    entry('und', 'p'),
    entry('Ei', 'n', ['s3']),
    entry('Kaffee mit Milch', 'n', ['s3']),
  ],
};

describe('lemmaTable', () => {
  const table = lemmaTable(odenet);

  it('keeps single words of three letters or more, by their lower case form, without stop words', () => {
    expect([...table.keys()].sort()).toEqual(['essen', 'hund', 'idee', 'kunde', 'schön']);
    // Essen and essen are one key with two entries
    expect(table.get('essen')?.entries).toHaveLength(2);
  });

  it('says whether a noun has a sense that is an everyday thing', () => {
    const noun = (word: string): Entry => must(odenet.entries.find((item) => item.word === word));
    expect(isEverydayNoun(noun('Hund'), kinds)).toBe(true);
    expect(isEverydayNoun(noun('Essen'), kinds)).toBe(true);
    expect(isEverydayNoun(noun('Idee'), kinds)).toBe(false);
    // one sense is a person, the other an idea: no sense of a thing
    expect(isEverydayNoun(noun('Kunde'), kinds)).toBe(false);
    // not a noun, or no sense of a known kind
    expect(isEverydayNoun(noun('schön'), kinds)).toBe(false);
    expect(isEverydayNoun(entry('Rätsel', 'n', ['unknown']), kinds)).toBe(false);
  });

  it('writes a thing with a capital letter and the other words as OdeNet does', () => {
    expect(odenetSpelling(must(table.get('hund')), kinds)).toBe('Hund');
    // essen is a verb and also a food (Essen): the thing wins, so it can be hidden
    expect(odenetSpelling(must(table.get('essen')), kinds)).toBe('Essen');
    expect(odenetSpelling(must(table.get('schön')), kinds)).toBe('schön');
    expect(odenetSpelling(must(table.get('idee')), kinds)).toBe('Idee');
  });
});

describe('englishWords', () => {
  const english = englishWords(new Set(['lamp', 'wine', 'price', 'city', 'quick']), ['although']);

  it('has the words of English with their regular forms and the commonest English words', () => {
    for (const word of ['lamp', 'lamps', 'wines', 'priced', 'cities', 'quickly', 'although']) {
      expect(english.has(word), word).toBe(true);
    }
  });

  it('has no German words', () => {
    for (const word of ['kuh', 'honig', 'hund', 'lampe']) {
      expect(english.has(word), word).toBe(false);
    }
  });
});

describe('spellingOf', () => {
  const lexicon: Lexicon = {
    titles: new Set(['Kuh', 'Kühe', 'laufen', 'Neue', 'neue', 'Anna', 'layers', 'Spiegel']),
    odenet: lemmaTable(odenet),
    kinds,
    english: new Set(['layers', 'spiegel']),
    allowed: new Set(['spiegel']),
  };

  it('writes a word of OdeNet as OdeNet does, and a noun of the Wiktionary with a capital letter', () => {
    expect(spellingOf('hund', lexicon)).toBe('Hund');
    expect(spellingOf('schön', lexicon)).toBe('schön');
    expect(spellingOf('kuh', lexicon)).toBe('Kuh');
    expect(spellingOf('kühe', lexicon)).toBe('Kühe');
    expect(spellingOf('laufen', lexicon)).toBe('laufen');
  });

  it('leaves out a token that is no word, a little word, an English word and a word nobody lists', () => {
    expect(spellingOf('xyzzy', lexicon)).toBeUndefined();
    expect(spellingOf('und', lexicon)).toBeUndefined();
    expect(spellingOf('layers', lexicon)).toBeUndefined();
    expect(spellingOf('ab', lexicon)).toBeUndefined();
    expect(spellingOf('hund1', lexicon)).toBeUndefined();
  });

  it('lets one of our own examples through even when the English list has it', () => {
    expect(spellingOf('spiegel', lexicon)).toBe('Spiegel');
  });
});

describe('chooseGermanVocabulary', () => {
  // The model in the order of its frequency, and how each token is spelled in the game
  const tokens = [
    'hund',
    'hunde',
    'xyz',
    'schön',
    'schöne',
    'neu',
    'neue',
    'hundes',
    'strasse',
    'straße',
    'katze',
  ];
  const spelled: Record<string, string> = {
    hund: 'Hund',
    hunde: 'Hunde',
    schön: 'schön',
    schöne: 'Schöne', // the Wiktionary has pages for both forms: a noun is the first guess
    neu: 'neu',
    neue: 'Neue',
    hundes: 'Hundes',
    strasse: 'Strasse',
    straße: 'Straße',
    katze: 'Katze',
  };
  const spell = (token: string): string | undefined => spelled[token];
  const close = new Set(['hund|hunde', 'hund|hundes', 'schön|schöne', 'neu|neue']);
  const similarity = (a: number, b: number): number =>
    close.has(`${tokens[a] ?? ''}|${tokens[b] ?? ''}`) ? 0.8 : 0.1;

  it('takes the tokens that are words and no form of another word, in the order of the model', () => {
    const { words } = chooseGermanVocabulary(tokens, similarity, spell, 100);
    expect(words.map((word) => word.key)).toEqual(['hund', 'schön', 'neu', 'strasse', 'katze']);
  });

  it('keeps the forms in a list of their own, written like their word', () => {
    const { forms } = chooseGermanVocabulary(tokens, similarity, spell, 100);
    expect(forms.map((form) => [form.display, form.lemma])).toEqual([
      ['Hunde', 'hund'],
      // a noun with a capital letter, an adjective without (the Wiktionary has both "neue" and "Neue")
      ['schöne', 'schön'],
      ['neue', 'neu'],
      ['Hundes', 'hund'],
    ]);
  });

  it('keeps one of two spellings of the same word (ss and ß), the commoner one', () => {
    const { words } = chooseGermanVocabulary(tokens, similarity, spell, 100);
    expect(words.map((word) => word.key)).toContain('strasse');
    expect(words.map((word) => word.key)).not.toContain('straße');
  });

  it('keeps a form only when it is close to its word in meaning, and an adjective needs less', () => {
    const far = chooseGermanVocabulary(tokens, () => FORM_SIMILARITY.a - 0.2, spell, 100);
    expect(far.forms).toEqual([]);
    expect(far.words.map((word) => word.key)).toContain('hunde');
    const between = chooseGermanVocabulary(
      tokens,
      (a, b) => (tokens[a] === 'neu' || tokens[b] === 'hunde' ? 0.52 : 0.1),
      spell,
      100,
    );
    expect(between.forms.map((form) => form.key)).toEqual(['neue']);
    expect(between.words.map((word) => word.key)).toContain('hunde');
  });

  it('follows a form of a form to the word at the end', () => {
    const chain = ['hund', 'hunde', 'hunden'];
    const all: Record<string, string> = { hund: 'Hund', hunde: 'Hunde', hunden: 'Hunden' };
    // hunde is made from hund; hunden is made from hunde (not from hund: it is only close to hunde)
    const link = (a: number, b: number): number =>
      chain[a] === 'hund' && chain[b] === 'hunde'
        ? 0.9
        : chain[a] === 'hunde' && chain[b] === 'hunden'
          ? 0.9
          : 0;
    const { words, forms } = chooseGermanVocabulary(chain, link, (token) => all[token], 100);
    expect(words.map((word) => word.key)).toEqual(['hund']);
    expect(forms.map((form) => [form.key, form.lemma])).toEqual([
      ['hunde', 'hund'],
      ['hunden', 'hund'],
    ]);
  });

  it('stops at the size, and looks for forms only as far as the limit', () => {
    expect(chooseGermanVocabulary(tokens, similarity, spell, 2).words).toHaveLength(2);
    expect(
      chooseGermanVocabulary(tokens, similarity, spell, 100, 4).forms.map((form) => form.key),
    ).toEqual(['hunde']);
  });
});

describe('chooseGermanSecrets', () => {
  const vocabulary = [
    { key: 'hund', display: 'Hund' },
    { key: 'schön', display: 'schön' },
    { key: 'idee', display: 'Idee' },
    { key: 'kuh', display: 'Kuh' },
    { key: 'apfelbaumblüte', display: 'Apfelbaumblüte' },
  ];
  const scores: Record<string, number> = {
    hund: 0.7,
    schön: 0.7,
    idee: 0.1,
    kuh: 0.2,
    apfelbaumblüte: 0.8,
  };
  const score = (key: string): number => scores[key] ?? -1;
  const everyday = (key: string): boolean => key === 'idee';
  const options = {
    rankLimit: 100,
    count: 10,
    minLength: 3,
    maxLength: 12,
    minScore: 0.5,
    minScoreWithOdenet: 0.3,
  };

  it('hides things close to the examples: nouns, not too long', () => {
    expect(chooseGermanSecrets(vocabulary, score, everyday, new Set(), options)).toEqual(['Hund']);
  });

  it('needs less closeness when OdeNet also says it is an everyday thing, and none for an example', () => {
    const lenient = { ...options, minScoreWithOdenet: 0.05 };
    expect(chooseGermanSecrets(vocabulary, score, everyday, new Set(), lenient)).toEqual([
      'Hund',
      'Idee',
    ]);
    expect(
      chooseGermanSecrets(vocabulary, score, everyday, new Set(), {
        ...options,
        allowed: new Set(['kuh']),
      }),
    ).toEqual(['Hund', 'Kuh']);
  });

  it('respects the block list, the length, the rank limit and the count', () => {
    const run = (extra: object, blocked: string[] = []): string[] =>
      chooseGermanSecrets(vocabulary, score, everyday, new Set(blocked), { ...options, ...extra });
    expect(run({}, ['hund'])).toEqual([]);
    expect(run({ minLength: 5 })).toEqual([]);
    expect(run({ maxLength: 3 })).toEqual([]);
    expect(run({ count: 0 })).toEqual([]);
    expect(run({ rankLimit: 0 })).toEqual([]);
  });
});

describe('chooseSynonyms', () => {
  // What OdeNet says (it also has insults and a deer for the bicycle), and how close the numbers are
  const odenetSays: Record<string, string[]> = {
    gehirn: ['hirn', 'denkorgan', 'gehirn'],
    hund: ['vierbeiner', 'arschloch', 'schwein'],
    fahrrad: ['rad', 'hirsch', 'bike'],
    auto: [],
  };
  const close: Record<string, number> = {
    'gehirn|hirn': 0.79,
    'gehirn|denkorgan': 0.4,
    'hund|vierbeiner': 0.61,
    'hund|arschloch': 0.25,
    'hund|schwein': 0.49,
    'fahrrad|rad': 0.87,
    'fahrrad|hirsch': 0.15,
    'fahrrad|bike': 0.71,
    'auto|wagen': 0.51,
  };
  const inList = new Set([
    'hirn',
    'denkorgan',
    'vierbeiner',
    'arschloch',
    'schwein',
    'rad',
    'hirsch',
    'bike',
    'wagen',
  ]);
  const run = (
    options: { removed?: Set<string>; added?: [string, string][] } = {},
  ): Map<string, string[]> =>
    chooseSynonyms(
      ['gehirn', 'hund', 'fahrrad', 'auto'],
      (key) => odenetSays[key] ?? [],
      (key) => inList.has(key),
      (a, b) => close[`${a}|${b}`] ?? 0,
      { minSimilarity: 0.7, ...options },
    );

  it('takes the words of OdeNet that are close to the hidden word in the numbers, the closest first', () => {
    const found = run();
    expect(found.get('gehirn')).toEqual(['hirn']);
    expect(found.get('fahrrad')).toEqual(['rad', 'bike']);
    // an insult, a pig and a deer are not the dog and the bicycle
    expect(found.has('hund')).toBe(false);
    expect(found.has('auto')).toBe(false);
  });

  it('can take a wrong pair away and add a right one that is not close enough', () => {
    const found = run({
      removed: new Set(['fahrrad>bike']),
      added: [
        ['auto', 'wagen'],
        ['hund', 'vierbeiner'],
        ['hund', 'notinlist'],
        ['fahrrad', 'rad'],
      ],
    });
    expect(found.get('fahrrad')).toEqual(['rad']);
    expect(found.get('auto')).toEqual(['wagen']);
    expect(found.get('hund')).toEqual(['vierbeiner']);
  });
});

describe('thingScorer', () => {
  // Two directions: animals point to x, tools to y; every word also carries the same common part
  const vectors: Record<string, number[]> = {
    hund: [5, 0.2, 1],
    katze: [5, 0.4, 1],
    hammer: [0.1, 5, 1],
    säge: [0.3, 5, 1],
    idee: [0.3, 0.3, 1],
  };
  const vectorOf = (word: string): Float32Array | undefined => {
    const numbers = vectors[word];
    return numbers === undefined ? undefined : Float32Array.from(numbers);
  };
  const seeds = { animals: ['hund', 'katze'], tools: ['hammer', 'säge', 'unknownword'] };

  it('scores a word by its cosine with the nearest kind, and an unknown word as -1', () => {
    const score = thingScorer(seeds, vectorOf);
    expect(score('hund')).toBeGreaterThan(0.9);
    expect(score('hammer')).toBeGreaterThan(0.9);
    expect(score('unknownword')).toBe(-1);
  });

  it('takes the common part away first, so that a vague word is far from every kind', () => {
    const plain = thingScorer(seeds, vectorOf);
    // the average of the words, as the build script takes it
    const center = Float32Array.from([2.1, 2.1, 1]);
    const centered = thingScorer(seeds, vectorOf, center);
    expect(plain('idee')).toBeGreaterThan(0.4);
    expect(centered('idee')).toBeLessThan(0.1);
    expect(centered('hund')).toBeGreaterThan(0.9);
  });
});
