import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { DIMENSIONS, makeWordData, parseWordList } from '../../logic/data';
import { guessWord, nearestWords, startRound, takeHint } from '../../logic/round';
import { similarityTo } from '../../logic/similarity';

// The data of the German game (see ../../README.md, "German"): 30,000 words with their numbers, the
// words that can be hidden with the words that mean the same, and the inflected forms. These tests
// look at the real files.

const here = (name: string): string =>
  new URL(name, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const vocabularyText = readFileSync(here('./vocabulary.txt'), 'utf8');
const secretsText = readFileSync(here('./secrets.txt'), 'utf8');
const formsText = readFileSync(here('./forms.txt'), 'utf8');
const bytes = readFileSync(here('./vectors.bin'));
const scripts = '../../../../../scripts/word-radar/';
const blockedText = readFileSync(here(`${scripts}blocked-secrets-de.txt`), 'utf8');
const synonymsText = readFileSync(here(`${scripts}synonyms-de.txt`), 'utf8');

const words = parseWordList(vocabularyText);
const secretLines = parseWordList(secretsText);
const secrets = secretLines.map((line) => line.split('\t')[0] ?? '');
const data = makeWordData(
  vocabularyText,
  new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  secretsText,
  'de',
  formsText,
);
const at = (word: string): number => {
  const index = data.indexOf.get(word.toLowerCase());
  if (index === undefined) {
    throw new Error(`${word} is not in the list`);
  }
  return index;
};

describe('the German word list of Word Radar', () => {
  it('has 30,000 words that differ even without their capitals, all made of letters', () => {
    expect(words).toHaveLength(30_000);
    expect(new Set(words.map((word) => word.toLowerCase())).size).toBe(words.length);
    for (const word of words) {
      expect(word, word).toMatch(/^[A-Za-zÄÖÜäöüß]{3,25}$/);
    }
  });

  it('writes nouns with a capital letter and the other words as they are', () => {
    for (const word of ['Hund', 'Haus', 'Kuh', 'Fahrrad', 'Wasser']) {
      expect(words, word).toContain(word);
    }
    for (const word of ['laufen', 'schön', 'schnell']) {
      expect(words, word).toContain(word);
    }
  });

  it('has basic words only: a plural or a genitive is a form, not a word of the list', () => {
    for (const word of ['Hunde', 'Hunden', 'Hundes', 'Häuser', 'Kühe', 'Gehirns', 'schöne']) {
      expect(words, word).not.toContain(word);
    }
  });

  it('has no little words that carry no meaning, and no English words that are not German', () => {
    for (const word of ['und', 'der', 'die', 'das', 'nicht', 'werden', 'zwischen', 'mit']) {
      expect(data.indexOf.has(word), word).toBe(false);
    }
    for (const word of ['wines', 'lamps', 'although', 'layers']) {
      expect(data.indexOf.has(word), word).toBe(false);
    }
  });

  it('has one row of 64 whole numbers for every word, and nothing else', () => {
    expect(bytes.length).toBe(words.length * DIMENSIONS);
    const used = new Set(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    expect(used.size).toBeGreaterThan(150);
  });
});

describe('the German forms', () => {
  it('lead to the word that a person means when they type a form', () => {
    const expected: [string, string][] = [
      ['hunde', 'hund'],
      ['hunden', 'hund'],
      ['hundes', 'hund'],
      ['häuser', 'haus'],
      ['kühe', 'kuh'],
      ['gehirns', 'gehirn'],
      ['schöne', 'schön'],
    ];
    for (const [form, word] of expected) {
      expect(data.forms.get(form), form).toBe(at(word));
    }
  });

  it('are many, each one leads to a word of the list, and none is a word of the list itself', () => {
    expect(data.forms.size).toBeGreaterThan(10_000);
    for (const [form, index] of data.forms) {
      expect(words[index], form).toBeDefined();
      expect(data.indexOf.has(form), form).toBe(false);
    }
  });
});

describe('the German words that can be hidden', () => {
  const blocked = new Set(
    blockedText
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .flatMap((line) => line.split(/\s+/))
      .filter(Boolean),
  );

  it('are enough, all different, nouns with a capital letter and in the word list', () => {
    expect(secrets.length).toBeGreaterThanOrEqual(900);
    expect(secrets.length).toBeLessThanOrEqual(3000);
    expect(new Set(secrets).size).toBe(secrets.length);
    for (const word of secrets) {
      expect(data.indexOf.has(word.toLowerCase()), word).toBe(true);
      expect(word, word).toMatch(/^\p{Lu}/u);
      expect(word.length, word).toBeGreaterThanOrEqual(3);
      expect(word.length, word).toBeLessThanOrEqual(12);
    }
    for (const word of ['Hund', 'Apfel', 'Ozean', 'Vulkan', 'Fahrrad', 'Kuh', 'Haus', 'Ziege']) {
      expect(secrets, word).toContain(word);
    }
  });

  it('are no forms: a plural is a valid guess but is not hidden', () => {
    for (const word of ['Hunde', 'Hunden', 'Häuser', 'Kühe', 'Äpfel', 'Gehirns']) {
      expect(secrets, word).not.toContain(word);
    }
  });

  it('never include a blocked word', () => {
    expect(blocked.size).toBeGreaterThan(300);
    expect(secrets.filter((word) => blocked.has(word.toLowerCase()))).toEqual([]);
    // and none of the words that a round must never be about
    for (const word of ['Penis', 'Sperma', 'Arsch', 'Pistole', 'Leiche', 'Tabak', 'Marihuana']) {
      expect(secrets, word).not.toContain(word);
    }
  });
});

describe('the German words that mean the same as a hidden word', () => {
  const synonymsOf = (word: string): string[] =>
    [...(data.aliases.get(at(word)) ?? [])].map((index) => words[index] ?? '');

  it('are words of the list, never the hidden word itself, and only for hidden words', () => {
    expect(data.aliases.size).toBeGreaterThan(80);
    for (const [secret, same] of data.aliases) {
      expect(data.secrets, words[secret]).toContain(secret);
      expect(same.has(secret), words[secret]).toBe(false);
      expect(same.size, words[secret]).toBeGreaterThan(0);
    }
  });

  it('include the pairs that a person expects, and not the ones that OdeNet gets wrong', () => {
    expect(synonymsOf('Gehirn')).toContain('Hirn');
    expect(synonymsOf('Fahrrad')).toEqual(expect.arrayContaining(['Rad', 'Velo']));
    expect(synonymsOf('Sofa')).toContain('Couch');
    expect(synonymsOf('Lkw')).toContain('Lastwagen');
    expect(synonymsOf('Auto').map((word) => word.toLowerCase())).toContain('wagen');
    // an insult for a dog, a bee for a hare, a pineapple for a strawberry, a light bulb for a pear
    for (const word of ['Arschloch', 'Schwein', 'Sack']) {
      expect(synonymsOf('Hund'), word).not.toContain(word);
    }
    expect(synonymsOf('Hase')).not.toContain('Biene');
    expect(synonymsOf('Erdbeere')).not.toContain('Ananas');
    expect(synonymsOf('Birne')).not.toContain('Glühbirne');
  });

  it('never contain a pair that was taken away in the file of corrections', () => {
    const removed = synonymsText
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim().split(/\s+/));
    expect(removed.length).toBeGreaterThan(30);
    for (const [secret = '', word = ''] of removed) {
      const index = data.indexOf.get(secret);
      const other = data.indexOf.get(word);
      if (index !== undefined && other !== undefined) {
        expect(data.aliases.get(index)?.has(other) ?? false, `${secret} ${word}`).toBe(false);
      }
    }
  });
});

describe('the meaning in the German numbers', () => {
  const similarity = (a: string, b: string): number => similarityTo(data, at(a))[at(b)] ?? 0;

  it('puts words that go together closer than words that do not', () => {
    const cases: [string, string, string][] = [
      ['König', 'Königin', 'Banane'],
      ['Hund', 'Katze', 'Auto'],
      ['Apfel', 'Birne', 'Hammer'],
      ['Vater', 'Mutter', 'Wolke'],
      ['Haus', 'Wohnung', 'Fisch'],
      ['Winter', 'Schnee', 'Motor'],
      ['Arzt', 'Krankenhaus', 'Berg'],
    ];
    for (const [word, near, far] of cases) {
      expect(similarity(word, near), `${word} ${near} ${far}`).toBeGreaterThan(
        similarity(word, far),
      );
    }
  });

  it('finds the neighbors that a person would expect', () => {
    const volcano = nearestWords(startRound(data, at('Vulkan')), data, 15).map(
      (guess) => guess.word,
    );
    expect(volcano[0]).toBe('Vulkan');
    expect(volcano).toContain('Krater');
    const bike = nearestWords(startRound(data, at('Fahrrad')), data, 15).map((guess) => guess.word);
    expect(bike).toContain('Rad');
  });

  it('shows no form among the nearest words: the list has basic words only', () => {
    const brain = nearestWords(startRound(data, at('Gehirn')), data, 40).map((guess) => guess.word);
    expect(brain).not.toContain('Gehirns');
    expect(brain).not.toContain('Neuronen');
    expect(brain).toContain('Nervensystem');
  });
});

describe('guessing in German', () => {
  const round = startRound(data, at('Vulkan'));
  const shown = (text: string): string => {
    const result = guessWord(round, data, text);
    return result.kind === 'ok' ? result.guess.word : result.kind;
  };

  it('finds a word in any case, and a form counts as its word', () => {
    for (const text of ['hund', 'HUND', ' Hund ', 'hunde']) {
      expect(shown(text), text).toBe('Hund');
    }
    const form = guessWord(round, data, ' Hunde ');
    expect(form.kind === 'ok' ? form.form : undefined).toBe('Hunde');
    const plain = guessWord(round, data, 'hund');
    expect(plain.kind === 'ok' ? plain.form : 'x').toBeUndefined();
  });

  it('finds a word typed without the umlauts and the sharp s, also a form of it', () => {
    expect(shown('koenig')).toBe('König');
    // Äpfel is a form of Apfel
    expect(shown('aepfel')).toBe('Apfel');
    expect(shown('Aepfel')).toBe('Apfel');
    // the list has one of Straße and Strasse, and both ways of typing find it
    expect(shown('strasse')).toBe(shown('straße'));
    expect(shown('strasse')).toMatch(/^Stra(ß|ss)e$/);
  });

  it('keeps a word that really has ae, oe, ue or ss in it as it is', () => {
    expect(shown('neue')).toBe('neu');
  });

  it('refuses what is no word of letters or not in the list, and costs nothing', () => {
    expect(guessWord(round, data, 'hund1').kind).toBe('invalid');
    expect(guessWord(round, data, 'a').kind).toBe('invalid');
    expect(guessWord(round, data, 'xyzxyzxyz').kind).toBe('unknown');
  });

  it('finds the hidden word with a form of it, and with a word that means the same', () => {
    const brain = startRound(data, at('Gehirn'));
    const byForm = guessWord(brain, data, 'gehirns');
    expect(byForm.kind === 'ok' ? [byForm.round.status, byForm.guess.rank] : []).toEqual([
      'won',
      1,
    ]);
    const bySynonym = guessWord(brain, data, 'Hirn');
    expect(bySynonym.kind).toBe('ok');
    if (bySynonym.kind === 'ok') {
      expect(bySynonym.round.status).toBe('won');
      expect(bySynonym.guess.rank).toBe(1);
      expect(bySynonym.guess.synonym).toBe(true);
      expect(bySynonym.guess.word).toBe('Hirn');
    }
    // another word that is only close does not win
    const near = guessWord(brain, data, 'Nervensystem');
    expect(near.kind === 'ok' ? near.round.status : '').toBe('playing');
  });
});

describe('the German hints', () => {
  it('come closer in small steps, from about rank 2,000 down to 2', () => {
    let round = startRound(data, at('Vulkan'));
    const ranks: number[] = [];
    for (let count = 0; count < 40; count += 1) {
      const hint = takeHint(round, data);
      if (hint === null) {
        break;
      }
      ranks.push(hint.guess.rank);
      round = hint.round;
    }
    expect(ranks.slice(0, 5)).toEqual([2000, 1000, 500, 250, 125]);
    expect(ranks.at(-1)).toBe(2);
  });

  it('are never a word that means the same as the hidden word: that would end the round', () => {
    let round = startRound(data, at('Gehirn'));
    const hirn = at('Hirn');
    for (let count = 0; count < 40; count += 1) {
      const hint = takeHint(round, data);
      if (hint === null) {
        break;
      }
      expect(hint.guess.index).not.toBe(hirn);
      expect(hint.round.status).toBe('playing');
      round = hint.round;
    }
    expect(round.guesses.length).toBeGreaterThan(5);
  });
});
