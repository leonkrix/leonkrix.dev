/**
 * The game before its first puzzle is there: the same boxes as the game (the bar, the board of
 * sixteen tiles, the line for the definition, the space for the result, the buttons) with empty
 * tiles and buttons that do nothing. The page renders it on the server as the placeholder of the
 * game, and the game shows it while its words are fetched, so the page is exactly as high before
 * the game as after it, at every width, and nothing below it jumps. If the real game gets another
 * box, this one needs it too: the layout guard of the end-to-end tests finds out when it differs.
 */
export default function LinkUpSkeleton({
  message = 'Loading the puzzle...',
}: {
  message?: string;
}) {
  return (
    <div className="lu" data-skeleton>
      <div className="lu-bar">
        <div className="lu-mistakes">
          <span className="lu-mistakes-label" aria-hidden="true">
            Mistakes left
          </span>
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="lu-dot" aria-hidden="true" />
          ))}
        </div>
        <div className="lu-actions">
          <button type="button" disabled>
            Shuffle
          </button>
          <button type="button" disabled>
            Deselect all
          </button>
        </div>
      </div>

      <div className="lu-toast" aria-hidden="true" />

      <div className="lu-board" data-layout-fluid>
        <div className="lu-grid" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => (
            <button key={index} type="button" className="lu-tile" disabled tabIndex={-1}>
              &nbsp;
            </button>
          ))}
        </div>
      </div>

      <div className="lu-info">
        <p role="status">
          <span className="lu-info-hint">{message}</span>
        </p>
        <button type="button" className="lu-eye" disabled aria-label="Show definitions" />
      </div>

      <div className="lu-end" />
      <div className="lu-footer">
        <button type="button" disabled>
          New puzzle
        </button>
        <button type="button" disabled>
          Copy link to this puzzle
        </button>
      </div>
    </div>
  );
}
