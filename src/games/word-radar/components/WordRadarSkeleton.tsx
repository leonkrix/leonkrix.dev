/**
 * The game before its words are there: the same boxes as the game (the field, the message, the
 * radar and the list, the buttons, the space for the result) with nothing in them and controls
 * that do nothing. The page renders it on the server as the placeholder of the game, and the game
 * shows it while the words (about 2 MB) are fetched, so the page is exactly as high before the
 * game as after it, at every width. If the real game gets another box, this one needs it too: the
 * layout guard of the end-to-end tests finds out when it differs.
 */
export default function WordRadarSkeleton({
  message = 'Loading the words (about 2 MB)...',
}: {
  message?: string;
}) {
  return (
    <div className="wr" data-skeleton>
      <form className="wr-form">
        <input
          className="wr-input"
          type="text"
          disabled
          placeholder="Type a word and press Enter"
          aria-label="Your guess"
        />
        <button type="submit" disabled data-primary>
          Guess
        </button>
      </form>

      <p className="wr-message" role="status">
        {message}
      </p>

      <div className="wr-main">
        <section className="wr-panel wr-radar-panel" aria-label="Radar">
          <div className="wr-switch" role="group" aria-label="Picture">
            <button type="button" aria-pressed="true" disabled>
              Radar
            </button>
            <button type="button" aria-pressed="false" disabled>
              Map
            </button>
          </div>
          <svg
            className="wr-radar"
            viewBox="-100 -100 200 200"
            aria-hidden="true"
            focusable="false"
          >
            <circle className="wr-disc" r="96" />
          </svg>
        </section>

        <section className="wr-panel wr-list-panel" aria-label="Guesses">
          <div className="wr-switch" role="group" aria-label="List">
            <button type="button" aria-pressed="true" disabled>
              Your guesses (0)
            </button>
            <button type="button" aria-pressed="false" disabled>
              Nearest words
            </button>
          </div>
          <div className="wr-latest" aria-hidden="true" />
          <div className="wr-list" />
        </section>
      </div>

      <div className="wr-tools">
        <button type="button" disabled>
          Hint
        </button>
        <button type="button" disabled>
          Give up
        </button>
        <button type="button" disabled>
          New round
        </button>
        <button type="button" disabled>
          Copy link to this round
        </button>
      </div>

      <div className="wr-end" />
    </div>
  );
}
