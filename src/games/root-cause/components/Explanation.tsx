import { type RefObject } from 'react';

interface ExplanationProps {
  /** One sentence for every step of the reasoning */
  lines: readonly string[];
  dialogRef: RefObject<HTMLDialogElement | null>;
}

/**
 * Why the person of a hint belongs where the hint says, step by step. It opens in a dialog over
 * the page (like the legend), so that nothing on the page moves, and closes with Escape, the
 * button, or a click outside.
 */
export function Explanation({ lines, dialogRef }: ExplanationProps) {
  return (
    <>
      {/* A click on the dark area around the dialog closes it, Escape works by itself */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <dialog
        ref={dialogRef}
        className="rc-dialog"
        aria-labelledby="rc-explain-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialogRef.current?.close();
          }
        }}
      >
        <div className="rc-dialog-head">
          <h3 id="rc-explain-title">Why here?</h3>
          <button
            type="button"
            className="rc-dialog-close"
            onClick={() => {
              dialogRef.current?.close();
            }}
          >
            Close
          </button>
        </div>
        <ol className="rc-explain-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </dialog>
    </>
  );
}
