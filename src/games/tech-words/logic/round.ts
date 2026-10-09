import { type TechTerm } from '../../shared/tech-term';
import { evaluateGuess, type LetterState } from './evaluate';

export const MAX_TRIES = 6;

export type RoundStatus = 'playing' | 'won' | 'lost';

/** The whole state of one round. Every function below returns a new round, nothing is changed. */
export interface Round {
  answer: TechTerm;
  length: number;
  guesses: readonly string[];
  /** The letters typed into the current row */
  current: string;
  status: RoundStatus;
}

export type SubmitOutcome =
  /** The row was used up; the round may now be won or lost */
  | 'accepted'
  /** Not enough letters typed yet */
  | 'too-short'
  /** The word is not in our list. The row is not used up. */
  | 'not-in-list'
  /** The round is already over */
  | 'finished';

export function startRound(answer: TechTerm): Round {
  return { answer, length: answer.term.length, guesses: [], current: '', status: 'playing' };
}

export function typeLetter(round: Round, letter: string): Round {
  const lower = letter.toLowerCase();
  if (
    round.status !== 'playing' ||
    !/^[a-z]$/.test(lower) ||
    round.current.length >= round.length
  ) {
    return round;
  }
  return { ...round, current: round.current + lower };
}

export function deleteLetter(round: Round): Round {
  if (round.status !== 'playing' || round.current === '') {
    return round;
  }
  return { ...round, current: round.current.slice(0, -1) };
}

/**
 * Hands in the current row. Only words from our list count (`isKnownTerm`), so a made-up word
 * never costs a try.
 */
export function submitGuess(
  round: Round,
  isKnownTerm: (word: string) => boolean,
): { round: Round; outcome: SubmitOutcome } {
  if (round.status !== 'playing') {
    return { round, outcome: 'finished' };
  }
  if (round.current.length < round.length) {
    return { round, outcome: 'too-short' };
  }
  if (!isKnownTerm(round.current)) {
    return { round, outcome: 'not-in-list' };
  }

  const guesses = [...round.guesses, round.current];
  const status: RoundStatus =
    round.current === round.answer.term ? 'won' : guesses.length >= MAX_TRIES ? 'lost' : 'playing';

  return { round: { ...round, guesses, current: '', status }, outcome: 'accepted' };
}

/** The result of every guess made so far, row by row. */
export function evaluatedRows(round: Round): LetterState[][] {
  return round.guesses.map((guess) => evaluateGuess(guess, round.answer.term));
}
