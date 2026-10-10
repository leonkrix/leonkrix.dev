import { useEffect, useState } from 'react';

import { type RandomSetup, sizesFor } from '../logic/random-level';
import { type Tier } from '../logic/types';
import { type Run } from './useGenerator';

interface RandomPanelProps {
  setup: RandomSetup;
  run: Run | undefined;
  error: string | undefined;
  onSetup: (setup: RandomSetup) => void;
  onStart: () => void;
  onCancel: () => void;
}

/** A progress that never reaches its end: the time a level takes is a matter of chance */
function fraction(elapsed: number, typical: number): number {
  return 0.95 * (1 - Math.exp(-elapsed / typical));
}

function seconds(milliseconds: number): string {
  return milliseconds < 1000 ? 'under a second' : `${String(Math.round(milliseconds / 1000))} s`;
}

/** Choose how hard and how big, and make a new level on the spot. */
export function RandomPanel({ setup, run, error, onSetup, onStart, onCancel }: RandomPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run === undefined) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 200);
    return () => {
      window.clearInterval(timer);
    };
  }, [run]);

  const elapsed = run === undefined ? 0 : Math.max(0, now - run.startedAt);
  const sizes = sizesFor(setup.tier);
  const making = run !== undefined;

  return (
    <div className="rc-random">
      <div className="rc-random-row">
        <label className="rc-field">
          <span className="sr-only">Difficulty</span>
          <select
            value={setup.tier}
            disabled={making}
            onChange={(event) => {
              const tier = event.target.value as Tier | 'any';
              const allowed = sizesFor(tier);
              onSetup({
                tier,
                size: setup.size !== 'any' && allowed.includes(setup.size) ? setup.size : 'any',
              });
            }}
          >
            <option value="any">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="rc-field">
          <span className="sr-only">Size</span>
          <select
            value={String(setup.size)}
            disabled={making}
            onChange={(event) => {
              onSetup({
                tier: setup.tier,
                size: event.target.value === 'any' ? 'any' : Number(event.target.value),
              });
            }}
          >
            <option value="any">Any size</option>
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}×{size}
              </option>
            ))}
          </select>
        </label>
        {making ? (
          <button type="button" className="rc-random-button" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button type="button" className="rc-random-button" data-primary onClick={onStart}>
            New level
          </button>
        )}
      </div>

      {run !== undefined && (
        <div className="rc-progress" role="status">
          <progress max={1} value={fraction(elapsed, run.typical)} aria-label="Making a level" />
          <p>
            Making a {run.job.tier} {String(run.job.size)}×{String(run.job.size)} level:{' '}
            {seconds(elapsed)} so far. This usually takes about {seconds(run.typical)}, but it is a
            matter of luck
            {run.workers > 1 ? ` (${String(run.workers)} threads are trying different maps)` : ''}.
            Every level is checked by two solvers before you see it.
          </p>
        </div>
      )}
      {error !== undefined && <p className="rc-error">{error}</p>}
    </div>
  );
}
