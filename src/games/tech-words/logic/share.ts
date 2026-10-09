import { evaluatedRows, MAX_TRIES, type Round } from './round';

const SQUARES = {
  correct: '\u{1F7E9}',
  present: '\u{1F7E8}',
  absent: '⬛',
} as const;

/** The result as text for sharing: a headline and one row of colored squares per guess. */
export function shareText(round: Round, url: string): string {
  const tries = round.status === 'won' ? String(round.guesses.length) : 'X';
  const grid = evaluatedRows(round)
    .map((row) => row.map((state) => SQUARES[state]).join(''))
    .join('\n');
  return `Tech Words, ${String(round.length)} letters, ${tries}/${String(MAX_TRIES)}\n\n${grid}\n\n${url}`;
}
