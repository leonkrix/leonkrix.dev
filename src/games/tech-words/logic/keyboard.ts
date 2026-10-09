import { evaluateGuess, type LetterState } from './evaluate';

const priority: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };

/**
 * What the on-screen keyboard shows for each letter that has been guessed: the best result seen
 * so far (correct beats present beats absent). Letters that were never guessed have no entry.
 */
export function keyStates(guesses: readonly string[], answer: string): Map<string, LetterState> {
  const states = new Map<string, LetterState>();

  for (const guess of guesses) {
    evaluateGuess(guess, answer).forEach((state, index) => {
      const letter = guess.charAt(index);
      const known = states.get(letter);
      if (known === undefined || priority[state] > priority[known]) {
        states.set(letter, state);
      }
    });
  }

  return states;
}
