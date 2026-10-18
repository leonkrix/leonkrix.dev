/**
 * The game before its levels are there: the same boxes as the game (the bar, the map, the status
 * line, the row of buttons, the panel and the text version) with nothing in them. The page renders
 * it on the server as the placeholder of the game, and the game shows it while the levels are
 * fetched, so the page is exactly as high before the game as after it, at every width.
 */
export default function BackboneSkeleton({
  message = 'Loading the levels...',
  onAll,
}: {
  message?: string;
  onAll?: () => void;
}) {
  return (
    <div className="bb-game" data-skeleton>
      <div className="bb-top">
        <a
          className="bb-all"
          href="?"
          onClick={(event) => {
            event.preventDefault();
            onAll?.();
          }}
        >
          All levels
        </a>
        <p className="bb-where">
          <span>Chapter 1</span>
          <strong>First packets</strong>
        </p>
        <ol className="bb-levels" aria-hidden="true">
          {[1, 2, 3, 4].map((number) => (
            <li key={number}>
              <button type="button" className="bb-level" disabled tabIndex={-1}>
                <span>{number}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="bb-body">
        <div className="bb" data-phase="route">
          <div className="bb-stage">
            <div className="bb-left">
              <div className="bb-map" style={{ aspectRatio: '100 / 80' }} aria-hidden="true" />
              <p className="bb-status" role="status">
                {message}
              </p>
              <div className="bb-under">
                <div className="bb-actions">
                  {['Undo', 'Redo', 'Clear', 'Auto: shortest', 'Auto: balanced', 'Run'].map(
                    (label) => (
                      <button key={label} type="button" disabled tabIndex={-1}>
                        {label}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
            <aside className="bb-panel" aria-hidden="true" data-layout-fluid />
          </div>

          <details className="bb-text">
            <summary>Text version of the network</summary>
          </details>
        </div>
      </div>
    </div>
  );
}
