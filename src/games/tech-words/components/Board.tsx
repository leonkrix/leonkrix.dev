import { type CSSProperties, type RefObject } from 'react';

import { evaluatedRows, MAX_TRIES, type Round } from '../logic/round';

interface BoardProps {
  round: Round;
  /**
   * Set while the row being typed was refused. It alternates between "a" and "b" on every refusal,
   * because switching between two animations is what restarts the shake.
   */
  shake: 'a' | 'b' | null;
  boardRef: RefObject<HTMLDivElement | null>;
}

type TileState = 'empty' | 'typed' | 'correct' | 'present' | 'absent';

function tileLabel(letter: string, state: TileState): string {
  if (state === 'empty') {
    return 'empty';
  }
  if (state === 'typed') {
    return letter;
  }
  return `${letter}, ${state === 'present' ? 'elsewhere' : state}`;
}

/** The grid of guesses: handed-in rows with their results, the row being typed, and empty rows. */
export function Board({ round, shake, boardRef }: BoardProps) {
  const rows = evaluatedRows(round);
  const typingRow = round.status === 'playing' ? rows.length : -1;

  return (
    <div
      ref={boardRef}
      role="grid"
      aria-label="Your guesses"
      tabIndex={-1}
      className="tw-board"
      style={{ '--len': round.length } as CSSProperties}
    >
      {Array.from({ length: MAX_TRIES }, (_, rowIndex) => {
        const guess = round.guesses[rowIndex] ?? (rowIndex === typingRow ? round.current : '');
        const states = rows[rowIndex];
        const won = round.status === 'won' && rowIndex === round.guesses.length - 1;

        return (
          <div
            key={rowIndex}
            role="row"
            className="tw-row"
            data-shake={rowIndex === typingRow ? (shake ?? undefined) : undefined}
            data-won={won ? '' : undefined}
          >
            {Array.from({ length: round.length }, (_, column) => {
              const letter = guess.charAt(column);
              const state: TileState = states?.[column] ?? (letter === '' ? 'empty' : 'typed');
              return (
                <div
                  key={column}
                  role="gridcell"
                  aria-label={tileLabel(letter, state)}
                  className="tw-tile"
                  data-state={state}
                  style={{ '--i': column } as CSSProperties}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
