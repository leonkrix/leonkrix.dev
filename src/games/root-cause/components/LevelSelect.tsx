import { STORIES, type Story } from '../data/stories';
import { skinWords } from '../data/words';
import { type RandomSetup } from '../logic/random-level';
import { type Tier } from '../logic/types';
import { type LevelRecord } from '../pool';
import { RandomPanel } from './RandomPanel';
import { SkinIcon } from './SkinIcon';
import { type Run } from './useGenerator';

const TIERS: readonly { tier: Tier; blurb: string }[] = [
  { tier: 'easy', blurb: 'Simple clues on a small map. A good place to learn the rules.' },
  { tier: 'medium', blurb: 'Clues that tie people to each other, and bigger maps.' },
  { tier: 'hard', blurb: 'Few clues, chains of reasoning, and the biggest maps.' },
];

const SKIN_NAMES: Readonly<Record<LevelRecord['skin'], string>> = {
  'case-file': 'Case file',
  outage: 'Outage',
};

interface LevelSelectProps {
  records: readonly LevelRecord[];
  setup: RandomSetup;
  run: Run | undefined;
  error: string | undefined;
  onSetup: (setup: RandomSetup) => void;
  onStart: () => void;
  onCancel: () => void;
  onPick: (id: string) => void;
}

/** The page before a level: one of the 18 levels, or a new random one. */
export function LevelSelect({
  records,
  setup,
  run,
  error,
  onSetup,
  onStart,
  onCancel,
  onPick,
}: LevelSelectProps) {
  return (
    <div className="rc-select">
      <h2 className="rc-select-title" tabIndex={-1} data-focus-target>
        Choose a level
      </h2>

      <ul className="rc-looks" aria-label="The two looks of the game">
        {(['case-file', 'outage'] as const).map((skin) => (
          <li key={skin}>
            <SkinIcon skin={skin} />
            <span>
              <strong>{SKIN_NAMES[skin]}</strong>
              <span>{skinWords[skin].about}</span>
            </span>
          </li>
        ))}
      </ul>

      {TIERS.map(({ tier, blurb }) => (
        <section key={tier} className="rc-select-tier" aria-labelledby={`rc-tier-${tier}`}>
          <h3 id={`rc-tier-${tier}`} className="rc-select-tier-name">
            {tier}
          </h3>
          <p className="rc-select-blurb">{blurb}</p>
          <ul className="rc-cards">
            {records
              .filter((entry) => entry.tier === tier)
              .map((entry, index) => {
                const story: Story | undefined = STORIES[entry.id];
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="rc-card"
                      onClick={() => {
                        onPick(entry.id);
                      }}
                    >
                      <span className="rc-card-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="rc-card-text">
                        <span className="rc-card-title">{story?.title ?? entry.id}</span>
                        <span className="rc-card-meta">
                          <SkinIcon skin={entry.skin} /> {String(entry.size)}×{String(entry.size)} ·{' '}
                          {SKIN_NAMES[entry.skin]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <section className="rc-select-tier" aria-labelledby="rc-tier-random">
        <h3 id="rc-tier-random" className="rc-select-tier-name">
          Random
        </h3>
        <p className="rc-select-blurb">
          A new level made on the spot, checked by two solvers before you see it. Choose how hard
          and how big, or leave it to chance.
        </p>
        <RandomPanel
          setup={setup}
          run={run}
          error={error}
          onSetup={onSetup}
          onStart={onStart}
          onCancel={onCancel}
        />
      </section>
    </div>
  );
}
