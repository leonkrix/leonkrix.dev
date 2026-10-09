import { type LetterState } from '../logic/evaluate';

interface KeyboardProps {
  states: ReadonlyMap<string, LetterState>;
  onLetter: (letter: string) => void;
  onEnter: () => void;
  onDelete: () => void;
}

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const;

/** Keeps the keyboard from taking the focus away from the page when it is pressed with a pointer. */
function keepFocus(event: { preventDefault: () => void }): void {
  event.preventDefault();
}

/** The on-screen keyboard. Letters turn green, amber or grey as the guesses reveal them. */
export function Keyboard({ states, onLetter, onEnter, onDelete }: KeyboardProps) {
  return (
    <div className="tw-keys" role="group" aria-label="Keyboard">
      {ROWS.map((letters, rowIndex) => (
        <div key={letters} className="tw-keyrow">
          {rowIndex === 2 && (
            <button
              type="button"
              className="tw-key"
              data-wide=""
              onPointerDown={keepFocus}
              onClick={onEnter}
            >
              Enter
            </button>
          )}
          {letters.split('').map((letter) => {
            const state = states.get(letter);
            return (
              <button
                key={letter}
                type="button"
                className="tw-key"
                data-state={state}
                aria-label={
                  state === undefined
                    ? letter
                    : `${letter}, ${state === 'present' ? 'elsewhere' : state}`
                }
                onPointerDown={keepFocus}
                onClick={() => {
                  onLetter(letter);
                }}
              >
                {letter}
              </button>
            );
          })}
          {rowIndex === 2 && (
            <button
              type="button"
              className="tw-key"
              data-wide=""
              aria-label="Delete"
              onPointerDown={keepFocus}
              onClick={onDelete}
            >
              {'⌫'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
