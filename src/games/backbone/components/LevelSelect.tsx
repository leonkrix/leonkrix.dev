import { chapters } from '../data/chapters';
import type { CatalogEntry } from '../data/pool';
import { settingNames } from '../data/setting-names';
import { type Tier, tiers } from '../logic/tiers';
import { Star } from './Svg';

/** The state of the random level maker, which lives in the game */
export interface RandomControls {
  tier: Tier;
  onTier: (tier: Tier) => void;
  running: boolean;
  error: string | undefined;
  onStart: () => void;
  onCancel: () => void;
}

const idle: RandomControls = {
  tier: 1,
  onTier: () => undefined,
  running: false,
  error: undefined,
  onStart: () => undefined,
  onCancel: () => undefined,
};

interface LevelSelectProps {
  catalog: readonly CatalogEntry[];
  stars: Readonly<Record<string, 0 | 1 | 2 | 3>>;
  /** A level was chosen (the card is a link too, so it also works before the game has started) */
  onPick: (id: string) => void;
  random?: RandomControls;
}

/**
 * The page before a level: every chapter with what is new in it, and its levels. The page renders
 * it on the server as the placeholder of the game (so it is a plain page of links until the game
 * has started), and the game shows the same thing, with the stars of this visit.
 */
export function LevelSelect({ catalog, stars, onPick, random = idle }: LevelSelectProps) {
  const shown = chapters.filter((chapter) =>
    catalog.some((entry) => entry.chapter === chapter.number),
  );
  return (
    <div className="bb-select">
      <h2 className="bb-select-title" tabIndex={-1} data-focus-target>
        Choose a level
      </h2>
      <p className="bb-select-intro">
        Every chapter adds one rule. All levels are open, so you can start anywhere, but the order
        is the one that teaches best. Stars you earn last until you leave the page; nothing is
        saved.
      </p>
      {shown.map((chapter, chapterAt) => {
        const levels = catalog.filter((entry) => entry.chapter === chapter.number);
        const earned = levels.reduce((sum, entry) => sum + (stars[entry.id] ?? 0), 0);
        return (
          <section
            key={chapter.number}
            className="bb-chapter-block"
            aria-labelledby={`bb-ch-${String(chapter.number)}`}
          >
            <h3 id={`bb-ch-${String(chapter.number)}`}>
              <span className="bb-chapter-number">Chapter {chapterAt + 1}</span> {chapter.title}
            </h3>
            <p className="bb-chapter-rule">{chapter.rule}</p>
            <p className="bb-chapter-stars">
              {earned} of {levels.length * 3} stars
            </p>
            <ul className="bb-cards">
              {levels.map((entry, at) => (
                <li key={entry.id}>
                  <a
                    className="bb-card"
                    href={`?level=${entry.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onPick(entry.id);
                    }}
                  >
                    <span className="bb-card-number" aria-hidden="true">
                      {at + 1}
                    </span>
                    <span className="bb-card-text">
                      <span className="bb-card-title">{entry.title}</span>
                      <span className="bb-card-meta">
                        {settingNames[entry.setting]} · {entry.nodes} nodes · {entry.flows} flows
                        {entry.situations > 1 ? ` · ${String(entry.situations)} situations` : ''}
                      </span>
                    </span>
                    <span
                      className="bb-card-stars"
                      role="img"
                      aria-label={`${String(stars[entry.id] ?? 0)} of 3 stars`}
                    >
                      {[1, 2, 3].map((number) => (
                        <Star key={number} filled={(stars[entry.id] ?? 0) >= number} />
                      ))}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className="bb-chapter-block" aria-labelledby="bb-random">
        <h3 id="bb-random">
          <span className="bb-chapter-number">Random</span> A new level on the spot
        </h3>
        <p className="bb-chapter-rule">
          A level made for you in your browser. Its best plan is proven before you see it, so the
          stars mean the same as in the campaign. Choose how hard.
        </p>
        <div className="bb-row" role="group" aria-label="How hard">
          {tiers.map((entry) => (
            <button
              key={entry.tier}
              type="button"
              className="bb-chip"
              aria-pressed={random.tier === entry.tier}
              title={entry.about}
              disabled={random.running}
              onClick={() => {
                random.onTier(entry.tier);
              }}
            >
              {entry.name}
            </button>
          ))}
        </div>
        <p className="bb-chapter-stars">{tiers[random.tier - 1]?.about}</p>
        <div className="bb-row">
          <button type="button" data-primary disabled={random.running} onClick={random.onStart}>
            {random.running ? 'Making a level...' : 'Make a level'}
          </button>
          {random.running && (
            <button type="button" onClick={random.onCancel}>
              Cancel
            </button>
          )}
        </div>
        <p className="bb-select-error" role="status">
          {random.error ?? ''}
        </p>
      </section>
    </div>
  );
}
