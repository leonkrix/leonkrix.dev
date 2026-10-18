import { type LevelIndex } from '../logic/graph';
import { eventTexts } from '../logic/text';
import { Svg } from './Svg';

/** More events than this in one step are counted ("+1 more"), so the status line keeps its height */
const MOST_TAGS = 2;

interface TimelineProps {
  index: LevelIndex;
  situation: number;
  step: number;
  playing: boolean;
  onSituation: (position: number) => void;
  onStep: (step: number) => void;
  onToggle: () => void;
}

/** The controls of the stress test: the situation, play and pause, and a scrubber over the steps. */
export function Timeline({
  index,
  situation,
  step,
  playing,
  onSituation,
  onStep,
  onToggle,
}: TimelineProps) {
  const { situations } = index.level;
  const current = situations[situation];
  const steps = current?.steps ?? 1;
  const events = current === undefined ? [] : eventTexts(index, current, step);
  return (
    <div className="bb-timeline">
      <div className="bb-row" role="group" aria-label="Situation">
        {situations.map((entry, at) => (
          <button
            key={entry.id}
            type="button"
            className="bb-chip"
            aria-pressed={at === situation}
            onClick={() => {
              onSituation(at);
            }}
          >
            {entry.name}
          </button>
        ))}
      </div>
      <div className="bb-scrub">
        <button
          type="button"
          className="bb-icon-button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={onToggle}
        >
          <Svg set="ui" name={playing ? 'pause' : 'play'} />
        </button>
        <button
          type="button"
          className="bb-icon-button"
          aria-label="Previous step"
          disabled={step <= 0}
          onClick={() => {
            onStep(step - 1);
          }}
        >
          <Svg set="ui" name="step-back" />
        </button>
        <input
          type="range"
          min={0}
          max={steps - 1}
          value={step}
          aria-label="Step"
          aria-valuetext={`Step ${String(step + 1)} of ${String(steps)}`}
          onChange={(event) => {
            onStep(Number(event.target.value));
          }}
        />
        <button
          type="button"
          className="bb-icon-button"
          aria-label="Next step"
          disabled={step >= steps - 1}
          onClick={() => {
            onStep(step + 1);
          }}
        >
          <Svg set="ui" name="step-forward" />
        </button>
      </div>
      <div className="bb-step-text" role="status">
        <span className="bb-step-count">
          Step <strong>{step + 1}</strong> of {steps}
        </span>
        {events.length > 0 ? (
          <ul className="bb-step-events" aria-label="What happens in this step">
            {events.slice(0, MOST_TAGS).map((event) => (
              <li key={`${event.kind}-${event.text}`} data-kind={event.kind}>
                {event.text}
              </li>
            ))}
            {events.length > MOST_TAGS && (
              <li data-kind="more">
                +{events.length - MOST_TAGS} more
                <span className="bb-sr">
                  :{' '}
                  {events
                    .slice(MOST_TAGS)
                    .map((event) => event.text)
                    .join(', ')}
                </span>
              </li>
            )}
          </ul>
        ) : (
          <span className="bb-step-quiet">All quiet</span>
        )}
      </div>
    </div>
  );
}
