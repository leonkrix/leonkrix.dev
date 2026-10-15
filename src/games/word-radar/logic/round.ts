import { createRandom } from '../../shared/random';
import { type WordData } from './data';
import { type Language } from './language';
import { type Ranking, rankWords } from './similarity';

export interface Guess {
  /** The position of the word in the list of words */
  index: number;
  word: string;
  /** 1 is the hidden word */
  rank: number;
  /** The cosine similarity to the hidden word, from about -0.2 to 1 */
  similarity: number;
  /** True for a word that was given by the hint button */
  hint: boolean;
  /** True for a word that means the same as the hidden word: it counts as finding it (rank 1) */
  synonym: boolean;
}

export type Status = 'playing' | 'won' | 'gaveUp';

export interface Round {
  secret: number;
  ranking: Ranking;
  /** In the order they were made */
  guesses: readonly Guess[];
  status: Status;
}

export type GuessResult =
  | { kind: 'ok'; round: Round; guess: Guess; form?: string }
  | { kind: 'duplicate'; guess: Guess }
  | { kind: 'unknown'; word: string }
  | { kind: 'invalid' }
  | { kind: 'over' };

/** The hidden word of a seed: the same seed always gives the same word. */
export function pickSecret(data: WordData, seed: number): number {
  const secret = data.secrets[createRandom(seed).int(data.secrets.length)];
  if (secret === undefined) {
    throw new Error('There are no words to hide');
  }
  return secret;
}

export function startRound(data: WordData, secret: number): Round {
  return { secret, ranking: rankWords(data, secret), guesses: [], status: 'playing' };
}

/** What the player typed, as a word: lower case letters only, or null. */
export function normalizeGuess(text: string, language: Language = 'en'): string | null {
  const word = text.trim().toLowerCase();
  // German words are longer (compounds) and have umlauts and the sharp s
  return (language === 'de' ? /^[a-zäöüß]{2,30}$/ : /^[a-z]{2,15}$/).test(word) ? word : null;
}

/**
 * The ways a German word can be typed on a keyboard without the special letters: ae, oe, ue and ss
 * for ä, ö, ü and ß ("Mueller", "Strasse"). The word as typed comes first, so a word that really
 * has these letters in a row ("neue", "Frauen") is found as it is.
 */
export function spellings(word: string, language: Language): string[] {
  if (language !== 'de') {
    return [word];
  }
  const umlauts = word.replaceAll('ae', 'ä').replaceAll('oe', 'ö').replaceAll('ue', 'ü');
  const sharp = word.replaceAll('ss', 'ß');
  // The word list has one of Straße and Strasse (the commoner one), so both ways are tried
  const double = word.replaceAll('ß', 'ss');
  return [...new Set([word, umlauts, sharp, double, umlauts.replaceAll('ss', 'ß')])];
}

function makeGuess(round: Round, data: WordData, index: number, hint: boolean): Guess {
  return {
    index,
    word: data.words[index] ?? '',
    rank: round.ranking.rankOf[index] ?? data.words.length,
    similarity: round.ranking.similarity[index] ?? 0,
    hint,
    synonym: false,
  };
}

function withGuess(round: Round, guess: Guess): Round {
  return {
    ...round,
    guesses: [...round.guesses, guess],
    status: guess.rank === 1 ? 'won' : round.status,
  };
}

/** Hands in a word. A word that is unknown or was tried before does not change the round. */
export function guessWord(round: Round, data: WordData, text: string): GuessResult {
  if (round.status !== 'playing') {
    return { kind: 'over' };
  }
  const word = normalizeGuess(text, data.language);
  if (word === null) {
    return { kind: 'invalid' };
  }
  // A word of the list, or else a form of one (typing Hunde counts as typing Hund)
  const tries = spellings(word, data.language);
  const own = tries.find((spelling) => data.indexOf.has(spelling));
  const asForm = own === undefined ? tries.find((spelling) => data.forms.has(spelling)) : undefined;
  const index =
    own !== undefined
      ? data.indexOf.get(own)
      : asForm === undefined
        ? undefined
        : data.forms.get(asForm);
  if (index === undefined) {
    return { kind: 'unknown', word };
  }
  const earlier = round.guesses.find((guess) => guess.index === index);
  if (earlier !== undefined) {
    return { kind: 'duplicate', guess: earlier };
  }
  const made = makeGuess(round, data, index, false);
  // A word that means the same as the hidden word finds it: it counts as rank 1
  const synonym = data.aliases.get(round.secret)?.has(index) === true;
  const guess = synonym ? { ...made, rank: 1, synonym: true } : made;
  return {
    kind: 'ok',
    round: withGuess(round, guess),
    guess,
    ...(asForm === undefined ? {} : { form: text.trim() }),
  };
}

/** The best (lowest) rank so far, or the size of the list when there is no guess yet. */
export function bestRank(round: Round, size: number): number {
  return round.guesses.reduce((best, guess) => Math.min(best, guess.rank), size);
}

/** A hint never starts farther away than this, whatever the best guess is */
const FIRST_HINT_FROM = 4000;

/**
 * A hint: a word that is closer than the best guess so far, at about half of its rank (so the ranks
 * go 2,000, 1,000, 500, 250, 125 and so on down to 2: small steps that keep a round going for a
 * long time). The first hint starts from rank 4,000 at the most. Returns null when there is none.
 */
export function takeHint(round: Round, data: WordData): { round: Round; guess: Guess } | null {
  if (round.status !== 'playing') {
    return null;
  }
  // A hint is never the hidden word or a word that means the same (that would end the round)
  const tried = new Set([
    ...round.guesses.map((guess) => guess.index),
    ...(data.aliases.get(round.secret) ?? []),
  ]);
  const best = bestRank(round, data.words.length);
  const target = Math.max(2, Math.round(Math.min(best, FIRST_HINT_FROM) / 2));
  // The wanted rank, or the next closer one that was not tried yet (never the hidden word itself)
  for (let rank = Math.min(target, best - 1); rank >= 2; rank -= 1) {
    const index = round.ranking.order[rank - 1];
    if (index !== undefined && !tried.has(index)) {
      const guess = makeGuess(round, data, index, true);
      return { round: withGuess(round, guess), guess };
    }
  }
  return null;
}

export function giveUp(round: Round): Round {
  return round.status === 'playing' ? { ...round, status: 'gaveUp' } : round;
}

/** The words closest to the hidden word, from the hidden word itself on. */
export function nearestWords(round: Round, data: WordData, count: number): Guess[] {
  return Array.from(round.ranking.order.subarray(0, count), (index) =>
    makeGuess(round, data, index, false),
  );
}
