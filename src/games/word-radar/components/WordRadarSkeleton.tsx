import { type Language } from '../logic/language';
import { texts } from '../logic/texts';

/**
 * The game before its words are there: the same boxes as the game (the field, the message, the
 * radar and the list, the buttons, the space for the result) with nothing in them and controls
 * that do nothing. The page renders it on the server as the placeholder of the game, and the game
 * shows it while the words (about 2 MB) are fetched, so the page is exactly as high before the
 * game as after it, at every width. If the real game gets another box, this one needs it too: the
 * layout guard of the end-to-end tests finds out when it differs.
 */
export default function WordRadarSkeleton({
  language = 'en',
  message,
}: {
  language?: Language;
  message?: string;
}) {
  const t = texts[language];
  return (
    <div className="wr" data-skeleton lang={language}>
      <form className="wr-form">
        <input
          className="wr-input"
          type="text"
          disabled
          placeholder={t.placeholder}
          aria-label={t.guessLabel}
        />
        <button type="submit" disabled data-primary>
          {t.guessButton}
        </button>
      </form>

      <p className="wr-message" role="status">
        {message ?? t.loading}
      </p>

      <div className="wr-main">
        <section className="wr-panel wr-radar-panel" aria-label={t.radarSection}>
          <div className="wr-switch" role="group" aria-label={t.pictureGroup}>
            <button type="button" aria-pressed="true" disabled>
              {t.radar}
            </button>
            <button type="button" aria-pressed="false" disabled>
              {t.map}
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

        <section className="wr-panel wr-list-panel" aria-label={t.guessesSection}>
          <div className="wr-switch" role="group" aria-label={t.listGroup}>
            <button type="button" aria-pressed="true" disabled>
              {t.yourGuesses(0)}
            </button>
            <button type="button" aria-pressed="false" disabled>
              {t.nearestWords}
            </button>
          </div>
          <div className="wr-latest" aria-hidden="true" />
          <div className="wr-list" />
        </section>
      </div>

      <div className="wr-tools">
        <button type="button" disabled>
          {t.hint(0)}
        </button>
        <button type="button" disabled>
          {t.giveUp}
        </button>
        <button type="button" disabled>
          {t.newRound}
        </button>
        <button type="button" disabled>
          {t.copyLink}
        </button>
      </div>

      <div className="wr-end" />
    </div>
  );
}
