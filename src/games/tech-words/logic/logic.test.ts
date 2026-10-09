import { describe, expect, it } from 'vitest';

import { createRandom } from '../../shared/random';
import { type TechTerm } from '../../shared/tech-term';
import { evaluateGuess, type LetterState } from './evaluate';
import { keyStates } from './keyboard';
import {
  deleteLetter,
  evaluatedRows,
  MAX_TRIES,
  startRound,
  submitGuess,
  typeLetter,
} from './round';
import {
  answerPool,
  categoryCounts,
  isWordLength,
  MIN_TERMS_PER_CATEGORY,
  selectTerm,
} from './select';
import { shareText } from './share';

/** "c" correct, "p" present, "a" absent: a compact way to write the expected result */
function states(code: string): LetterState[] {
  const names = { c: 'correct', p: 'present', a: 'absent' } as const;
  return code.split('').map((letter) => names[letter as keyof typeof names]);
}

function term(word: string, category: TechTerm['category'] = 'cs'): TechTerm {
  return { term: word, category, definition: `Definition of ${word}.` };
}

describe('evaluateGuess', () => {
  it.each([
    // [guess, answer, expected]
    ['stack', 'stack', 'ccccc'],
    ['query', 'stack', 'aaaaa'],
    ['slack', 'stack', 'caccc'],
    ['tacks', 'stack', 'ppppp'],
    // The second "s" is absent: the answer has only one, and the first "s" used it up
    ['class', 'stack', 'pacpa'],
    // Only one "e" in the answer: the first one is present, the second one is absent
    ['speed', 'abide', 'aapap'],
    // The correct "e" at the end claims its copy first, so only one more "e" can be present
    ['eerie', 'there', 'papac'],
    ['aaa', 'abc', 'caa'],
    ['abc', 'aab', 'cpa'],
    ['abb', 'bab', 'ppc'],
  ])('evaluates %s against %s', (guess, answer, expected) => {
    expect(evaluateGuess(guess, answer)).toEqual(states(expected));
  });

  it('rejects a guess of the wrong length', () => {
    expect(() => evaluateGuess('ab', 'abc')).toThrow(RangeError);
  });
});

describe('keyStates', () => {
  it('keeps the best result per letter and has no entry for letters never guessed', () => {
    // Answer "stack": "class" gives c present, l absent, a correct, s present (first) and absent
    // (second), and "slack" later makes s correct
    const first = keyStates(['class'], 'stack');
    expect(first.get('c')).toBe('present');
    expect(first.get('l')).toBe('absent');
    expect(first.get('a')).toBe('correct');
    expect(first.get('s')).toBe('present');
    expect(first.has('z')).toBe(false);

    const later = keyStates(['class', 'slack'], 'stack');
    expect(later.get('s')).toBe('correct');
    expect(later.get('c')).toBe('correct');
    expect(later.get('l')).toBe('absent');
  });

  it('never lets a worse result replace a better one', () => {
    // "aab" against "abb": the first "a" is correct, the second "a" is absent, "b" is correct
    expect(keyStates(['aab'], 'abb').get('a')).toBe('correct');
  });

  it('is empty without guesses', () => {
    expect(keyStates([], 'stack').size).toBe(0);
  });
});

describe('round', () => {
  const known = (word: string): boolean => ['cache', 'stack', 'array', 'queue'].includes(word);
  const answer = term('stack');

  it('starts empty and playing, with the length of the answer', () => {
    const round = startRound(answer);
    expect(round).toMatchObject({ length: 5, guesses: [], current: '', status: 'playing' });
  });

  it('types letters in lower case up to the length and ignores everything else', () => {
    let round = startRound(answer);
    for (const key of ['S', 't', '1', ' ', 'Enter', 'ab', 'a', 'c', 'k', 'x']) {
      round = typeLetter(round, key);
    }
    expect(round.current).toBe('stack');
  });

  it('deletes the last letter, and nothing when the row is empty', () => {
    let round = typeLetter(typeLetter(startRound(answer), 'a'), 'b');
    round = deleteLetter(round);
    expect(round.current).toBe('a');
    expect(deleteLetter(deleteLetter(round)).current).toBe('');
  });

  it('does not change the round it was given', () => {
    const round = startRound(answer);
    typeLetter(round, 'a');
    expect(round.current).toBe('');
  });

  it('refuses a short row and a word that is not in the list, without using up a try', () => {
    let round = typeLetter(typeLetter(startRound(answer), 'a'), 'b');
    expect(submitGuess(round, known)).toEqual({ round, outcome: 'too-short' });

    round = { ...round, current: 'abcde' };
    const result = submitGuess(round, known);
    expect(result.outcome).toBe('not-in-list');
    expect(result.round.guesses).toEqual([]);
    expect(result.round.current).toBe('abcde');
  });

  it('accepts a known word, clears the row and keeps playing', () => {
    const round = { ...startRound(answer), current: 'cache' };
    const result = submitGuess(round, known);
    expect(result.outcome).toBe('accepted');
    expect(result.round).toMatchObject({ guesses: ['cache'], current: '', status: 'playing' });
  });

  it('is won by the answer, on any row', () => {
    const round = { ...startRound(answer), guesses: ['cache', 'array'], current: 'stack' };
    const result = submitGuess(round, known);
    expect(result.round.status).toBe('won');
    expect(result.round.guesses).toHaveLength(3);
  });

  it('is lost after the last wrong try', () => {
    let round = startRound(answer);
    for (let tries = 1; tries <= MAX_TRIES; tries += 1) {
      expect(round.status).toBe('playing');
      round = submitGuess({ ...round, current: 'cache' }, known).round;
    }
    expect(round.status).toBe('lost');
  });

  it('can be won with the last try', () => {
    let round = startRound(answer);
    for (let tries = 1; tries < MAX_TRIES; tries += 1) {
      round = submitGuess({ ...round, current: 'cache' }, known).round;
    }
    expect(submitGuess({ ...round, current: 'stack' }, known).round.status).toBe('won');
  });

  it('takes no more input once it is over', () => {
    const won = submitGuess({ ...startRound(answer), current: 'stack' }, known).round;
    expect(typeLetter(won, 'a')).toBe(won);
    expect(deleteLetter(won)).toBe(won);
    expect(submitGuess(won, known)).toEqual({ round: won, outcome: 'finished' });
  });

  it('evaluates every guess against the answer', () => {
    const round = { ...startRound(answer), guesses: ['cache', 'stack'] };
    expect(evaluatedRows(round)).toEqual([states('ppaaa'), states('ccccc')]);
  });
});

describe('selecting a term', () => {
  const terms = [
    ...['aaa', 'bbb', 'ccc', 'ddd', 'eee'].map((word) => term(word, 'web')),
    ...['fff', 'ggg'].map((word) => term(word, 'ml')),
    term('hhh', 'os'),
  ];

  it('counts the terms per category', () => {
    expect(categoryCounts(terms)).toEqual(
      new Map([
        ['web', 5],
        ['ml', 2],
        ['os', 1],
      ]),
    );
  });

  it('filters by category, or takes everything', () => {
    expect(answerPool(terms, 'ml').map((entry) => entry.term)).toEqual(['fff', 'ggg']);
    expect(answerPool(terms, 'all')).toHaveLength(8);
  });

  it('picks from the chosen category when it has enough terms', () => {
    const random = createRandom(1);
    for (let index = 0; index < 50; index += 1) {
      expect(selectTerm(terms, 'web', random).category).toBe('web');
    }
    expect(MIN_TERMS_PER_CATEGORY).toBe(5);
  });

  it('falls back to all terms when the category has too few', () => {
    const random = createRandom(2);
    const picked = new Set(Array.from({ length: 200 }, () => selectTerm(terms, 'ml', random).term));
    expect(picked.size).toBeGreaterThan(2);
  });

  it('picks the same term for the same seed', () => {
    expect(selectTerm(terms, 'all', createRandom('seed'))).toEqual(
      selectTerm(terms, 'all', createRandom('seed')),
    );
  });

  it('recognizes the offered word lengths', () => {
    expect([2, 3, 4, 5, 6].filter(isWordLength)).toEqual([3, 4, 5]);
  });
});

describe('shareText', () => {
  it('shows the tries and one row of squares per guess', () => {
    const round = {
      ...startRound(term('stack')),
      guesses: ['cache', 'stack'],
      status: 'won' as const,
    };
    const text = shareText(round, 'https://leonkrix.dev/games/tech-words/');
    expect(text.split('\n')).toEqual([
      'Tech Words, 5 letters, 2/6',
      '',
      '\u{1F7E8}\u{1F7E8}⬛⬛⬛',
      '\u{1F7E9}\u{1F7E9}\u{1F7E9}\u{1F7E9}\u{1F7E9}',
      '',
      'https://leonkrix.dev/games/tech-words/',
    ]);
  });

  it('writes an X instead of the tries when the round was lost', () => {
    const round = { ...startRound(term('cat')), guesses: ['dog'], status: 'lost' as const };
    expect(shareText(round, 'u').split('\n')[0]).toBe('Tech Words, 3 letters, X/6');
  });
});
