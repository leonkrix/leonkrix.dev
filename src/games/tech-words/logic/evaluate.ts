export type LetterState = 'correct' | 'present' | 'absent';

/**
 * Compares a guess with the answer, letter by letter.
 *
 * - correct: the letter is in the answer at this position
 * - present: the letter is in the answer elsewhere, and not already used up by another tile
 * - absent: no unused copy of the letter is left in the answer
 *
 * Repeated letters are counted: with the answer "stack" and the guess "class" only the first "s"
 * after the correct "a" can be marked, the second one is absent. Correct tiles are handed out
 * first, then present tiles from left to right.
 */
export function evaluateGuess(guess: string, answer: string): LetterState[] {
  if (guess.length !== answer.length) {
    throw new RangeError(
      `The guess "${guess}" and the answer have different lengths (${String(guess.length)} and ${String(answer.length)})`,
    );
  }

  const states = Array.from<LetterState>({ length: guess.length }).fill('absent');
  const unused = new Map<string, number>();

  for (let index = 0; index < answer.length; index += 1) {
    const letter = answer.charAt(index);
    if (guess.charAt(index) === letter) {
      states[index] = 'correct';
    } else {
      unused.set(letter, (unused.get(letter) ?? 0) + 1);
    }
  }

  for (let index = 0; index < guess.length; index += 1) {
    if (states[index] === 'correct') {
      continue;
    }
    const letter = guess.charAt(index);
    const left = unused.get(letter) ?? 0;
    if (left > 0) {
      states[index] = 'present';
      unused.set(letter, left - 1);
    }
  }

  return states;
}
