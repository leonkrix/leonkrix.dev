import { describe, expect, it } from 'vitest';

import { DIMENSIONS, makeWordData } from './data';
import { languages, locales, parseLanguage } from './language';
import { buildRoundUrl, parseSeed } from './link';
import { buckets } from './radar';
import { guessWord, normalizeGuess, spellings, startRound, takeHint } from './round';
import { texts } from './texts';

describe('the language of the address', () => {
  it('is German only for ?lang=de, anything else is English', () => {
    expect(parseLanguage('?lang=de')).toBe('de');
    expect(parseLanguage('?seed=5&lang=de')).toBe('de');
    expect(parseLanguage('')).toBe('en');
    expect(parseLanguage('?lang=en')).toBe('en');
    expect(parseLanguage('?lang=fr')).toBe('en');
    expect(parseLanguage('?lang=DE')).toBe('en');
  });

  it('is kept in the link of a round, and the seed still reads', () => {
    expect(buildRoundUrl('https://x.test/games/word-radar/', 42)).toBe(
      'https://x.test/games/word-radar/?seed=42',
    );
    const german = buildRoundUrl('https://x.test/games/word-radar/', 42, 'de');
    expect(german).toBe('https://x.test/games/word-radar/?lang=de&seed=42');
    const query = german.slice(german.indexOf('?'));
    expect(parseLanguage(query)).toBe('de');
    expect(parseSeed(query, () => 0)).toBe(42);
  });

  it('formats numbers as the language does', () => {
    expect((12_345).toLocaleString(locales.en)).toBe('12,345');
    expect((12_345).toLocaleString(locales.de)).toBe('12.345');
  });
});

describe('typing a German word', () => {
  it('accepts letters with umlauts and the sharp s, up to a long compound, in any case', () => {
    expect(normalizeGuess(' Straße ', 'de')).toBe('straße');
    expect(normalizeGuess('ÄPFEL', 'de')).toBe('äpfel');
    expect(normalizeGuess('Geschwindigkeitsbegrenzung', 'de')).toBe('geschwindigkeitsbegrenzung');
    expect(normalizeGuess('a', 'de')).toBeNull();
    expect(normalizeGuess('zwei wörter', 'de')).toBeNull();
    expect(normalizeGuess('hund1', 'de')).toBeNull();
  });

  it('refuses an umlaut in the English game, which has only a to z', () => {
    expect(normalizeGuess('äpfel')).toBeNull();
    expect(normalizeGuess('apple')).toBe('apple');
  });

  it('tries the spellings without the special letters, the word as typed first', () => {
    expect(spellings('koenig', 'de')[0]).toBe('koenig');
    expect(spellings('koenig', 'de')).toContain('könig');
    expect(spellings('strasse', 'de')).toContain('straße');
    expect(spellings('straße', 'de')).toContain('strasse');
    expect(spellings('mueller', 'de')).toContain('müller');
    // English has none of this
    expect(spellings('koenig', 'en')).toEqual(['koenig']);
  });

  it('finds the word of the list however it was typed', () => {
    const words = ['Hund', 'Äpfel', 'Straße', 'König', 'neue'];
    const bytes = new Int8Array(words.length * DIMENSIONS);
    words.forEach((_, index) => {
      bytes[index * DIMENSIONS] = 10 + index;
      bytes[index * DIMENSIONS + 1] = 20 - index;
    });
    const data = makeWordData(`${words.join('\n')}\n`, bytes, 'Hund\n', 'de');
    const round = startRound(data, 0);
    const shown = (text: string): string => {
      const result = guessWord(round, data, text);
      return result.kind === 'ok' ? result.guess.word : result.kind;
    };
    expect(shown('äpfel')).toBe('Äpfel');
    expect(shown('aepfel')).toBe('Äpfel');
    expect(shown('STRASSE')).toBe('Straße');
    expect(shown('koenig')).toBe('König');
    // a word that really has ue in it is found as it is, before the other spellings are tried
    expect(shown('neue')).toBe('neue');
    expect(shown('nichtda')).toBe('unknown');
  });
});

describe('the texts', () => {
  it('exist in both languages with every bucket named', () => {
    for (const language of languages) {
      const t = texts[language];
      for (const bucket of buckets) {
        expect(t.bucket[bucket.id], `${language} ${bucket.id}`).not.toBe('');
      }
    }
  });

  it('are translated: apart from a few words that are the same, no German text equals the English', () => {
    const same = new Set(['radarSection', 'radar']);
    const english = texts.en;
    const german = texts.de;
    for (const key of Object.keys(english) as (keyof typeof english)[]) {
      if (same.has(key)) {
        continue;
      }
      const a = english[key];
      const b = german[key];
      if (typeof a === 'string' && typeof b === 'string') {
        expect(b, key).not.toBe(a);
      } else if (typeof a === 'function' && typeof b === 'function') {
        // The functions take different numbers of arguments, so only call the ones with numbers
        // and words that both have
        const callA = a as (...arguments_: unknown[]) => string;
        const callB = b as (...arguments_: unknown[]) => string;
        expect(callB('Wort', 3, 2), key).not.toBe(callA('Wort', 3, 2));
      }
    }
  });

  it('say the same things with the numbers and words that are given', () => {
    expect(texts.en.found('dog', 1)).toBe('Found it! The word is dog, after 1 guess.');
    expect(texts.en.found('dog', 3)).toBe('Found it! The word is dog, after 3 guesses.');
    expect(texts.de.found('Hund', 1)).toBe('Gefunden! Das Wort ist Hund, nach 1 Tipp.');
    expect(texts.de.found('Hund', 3)).toBe('Gefunden! Das Wort ist Hund, nach 3 Tipps.');
    expect(texts.de.summary(4, 1)).toBe('4 Tipps, 1 Hinweis.');
    expect(texts.de.summary(4, 2)).toBe('4 Tipps, 2 Hinweise.');
    expect(texts.en.hint(0)).toBe('Hint');
    expect(texts.de.hint(2)).toBe('Hinweis (2)');
    expect(texts.de.described('Hund', '1.000', 'warm')).toBe('Hund: Rang 1.000, warm');
  });
});

describe('forms and words that mean the same, in a small list', () => {
  // Gehirn, its synonym Hirn (the nearest word), a word that is only close, and a far one
  const words = ['Gehirn', 'Hirn', 'Nerv', 'Auto'];
  const numbers = [
    [10, 0],
    [9, 3],
    [5, 5],
    [0, 10],
  ];
  const bytes = new Int8Array(words.length * DIMENSIONS);
  numbers.forEach((row, index) => {
    bytes.set(row, index * DIMENSIONS);
  });
  const make = (secrets: string, forms: string) =>
    makeWordData(`${words.join('\n')}\n`, bytes, secrets, 'de', forms);

  it('treats a form as its word, and says so', () => {
    const data = make('Gehirn\n', 'Gehirns\t0\nGehirne\t0\nHirne\t1\n');
    const result = guessWord(startRound(data, 0), data, 'gehirne');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.guess.word).toBe('Gehirn');
      expect(result.form).toBe('gehirne');
      expect(result.round.status).toBe('won');
      expect(result.guess.synonym).toBe(false);
    }
  });

  it('counts a form of a word that was guessed as a repeat', () => {
    const data = make('Auto\n', 'Hirne\t1\n');
    const first = guessWord(startRound(data, 3), data, 'hirn');
    expect(first.kind).toBe('ok');
    if (first.kind === 'ok') {
      const second = guessWord(first.round, data, 'Hirne');
      expect(second.kind).toBe('duplicate');
      expect(second.kind === 'duplicate' ? second.guess.word : '').toBe('Hirn');
    }
  });

  it('counts a word that means the same as finding the hidden word, with rank 1', () => {
    const data = make('Gehirn\tHirn\n', '');
    const result = guessWord(startRound(data, 0), data, 'hirn');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.round.status).toBe('won');
      expect(result.guess).toMatchObject({ word: 'Hirn', rank: 1, synonym: true });
    }
    // without the line of synonyms it is only the nearest word
    const plain = make('Gehirn\n', '');
    const near = guessWord(startRound(plain, 0), plain, 'hirn');
    expect(near.kind === 'ok' ? [near.guess.rank, near.round.status] : []).toEqual([2, 'playing']);
  });

  it('never gives a word that means the same as a hint: it would end the round', () => {
    // The first hint of a list this small is the word at rank 2, which is Hirn
    const plain = make('Gehirn\n', '');
    expect(takeHint(startRound(plain, 0), plain)?.guess.word).toBe('Hirn');
    const data = make('Gehirn\tHirn\n', '');
    expect(takeHint(startRound(data, 0), data)).toBeNull();
  });

  it('refuses a line of a form or a synonym that points to nothing', () => {
    expect(() => make('Gehirn\tNichtda\n', '')).toThrow('synonym');
    expect(() => make('Gehirn\n', 'Gehirns\t99\n')).toThrow('points to no word');
    expect(() => make('Nichtda\n', '')).toThrow('hidden word');
  });
});

describe('the texts for forms and words that mean the same', () => {
  it('say what happened in both languages', () => {
    expect(`${texts.de.viaForm('Hunde')}${texts.de.described('Hund', '5', 'warm')}`).toBe(
      'Hunde zählt als Hund: Rang 5, warm',
    );
    expect(`${texts.en.viaForm('dogs')}${texts.en.described('dog', '5', 'warm')}`).toBe(
      'dogs counts as dog: rank 5, warm',
    );
    expect(texts.de.foundByForm('Gehirns', 'Gehirn', 2)).toBe(
      'Gehirns zählt als Gehirn. Gefunden! Nach 2 Tipps.',
    );
    expect(texts.de.foundSynonym('Hirn', 'Gehirn', 1)).toBe(
      'Hirn bedeutet dasselbe: Gefunden! Das Wort ist Gehirn, nach 1 Tipp.',
    );
    expect(texts.en.foundSynonym('brain', 'cerebrum', 3)).toBe(
      'brain means the same: found it! The word is cerebrum, after 3 guesses.',
    );
  });
});
