import { type LevelIndex } from '../logic/graph';
import { type Baselines, starsFor, type Thresholds } from '../logic/stars';
import { describeBusiest, summarize } from '../logic/text';
import type { Evaluation } from '../logic/types';
import { MiniMap } from './MiniMap';
import { Star } from './Svg';

interface ResultPanelProps {
  index: LevelIndex;
  you: Evaluation;
  shortest: Evaluation;
  balanced: Evaluation;
  best: Evaluation;
  baselines: Baselines;
  thresholds: Thresholds;
  assisted: boolean;
  /** The situation whose pictures are shown */
  situation: number;
  /** The level has been solved (one star or more) in this visit, so the best plan may be shown */
  solved: boolean;
  isLast: boolean;
  onEdit: () => void;
  onNext: () => void;
  onLoadBest: () => void;
}

function points(score: number): string {
  return String(Math.round(score * 100));
}

export function ResultPanel({
  index,
  you,
  shortest,
  balanced,
  best,
  baselines,
  thresholds,
  assisted,
  situation,
  solved,
  isLast,
  onEdit,
  onNext,
  onLoadBest,
}: ResultPanelProps) {
  const stars = assisted ? 0 : starsFor(you.score, thresholds);
  const summary = summarize(index, you);
  const worst = summary.worstFlow;
  const names = new Map(index.level.flows.map((flow) => [flow.id, flow.name]));
  return (
    <div className="bb-result">
      <div className="bb-score">
        <p className="bb-score-number" aria-live="polite">
          <span className="bb-score-label">Score</span>
          <strong>{points(you.score)}</strong>
          <span className="bb-score-of">of 100</span>
        </p>
        <p
          className="bb-stars"
          aria-label={
            assisted ? 'No stars: a helper filled in the plan' : `${String(stars)} of 3 stars`
          }
        >
          {[1, 2, 3].map((number) => (
            <Star key={number} filled={stars >= number} />
          ))}
        </p>
      </div>
      <p className="bb-verdict">
        {assisted
          ? 'A helper filled in this plan, so it earns no stars. Change it, or build your own.'
          : stars === 3
            ? 'Within reach of the best plan.'
            : stars === 2
              ? 'Better than both simple strategies.'
              : stars === 1
                ? 'Better than the shortest path. The simple strategies are still ahead of a bare minimum, though.'
                : 'Not yet as good as everybody taking the shortest path.'}
      </p>
      <p className="bb-thresholds">
        Stars at {points(thresholds.one)} · {points(thresholds.two)} · {points(thresholds.three)}
      </p>

      <div className="bb-minis" role="group" aria-label="Your plan next to the others">
        <MiniMap
          index={index}
          evaluation={you}
          situation={situation}
          title="Your plan"
          score={you.score}
          you
        />
        <MiniMap
          index={index}
          evaluation={shortest}
          situation={situation}
          title="Shortest path"
          score={baselines.shortest}
        />
        <MiniMap
          index={index}
          evaluation={balanced}
          situation={situation}
          title="Load balanced"
          score={baselines.balanced}
        />
        <MiniMap
          index={index}
          evaluation={best}
          situation={situation}
          title="Best plan"
          score={baselines.best}
          locked={!solved}
        />
      </div>

      <ul className="bb-notes">
        <li>{describeBusiest(index, summary)}</li>
        {worst !== undefined && (
          <li>
            {names.get(worst.flow)} lost {Math.round(worst.lost * 100)} % of its value.
          </li>
        )}
      </ul>

      <table className="bb-table">
        <caption>What each flow earned</caption>
        <thead>
          <tr>
            <th scope="col">Flow</th>
            <th scope="col">Earned</th>
          </tr>
        </thead>
        <tbody>
          {summary.flows.map((entry) => (
            <tr key={entry.flow}>
              <th scope="row">{names.get(entry.flow)}</th>
              <td>
                <span className="bb-bar" aria-hidden="true">
                  <span style={{ width: `${String(Math.round(entry.earned * 100))}%` }} />
                </span>
                {Math.round(entry.earned * 100)} %
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bb-row">
        <button type="button" onClick={onEdit}>
          Change the plan
        </button>
        {solved && (
          <button type="button" onClick={onLoadBest}>
            Load the best plan
          </button>
        )}
        {!isLast && (
          <button type="button" data-primary onClick={onNext}>
            Next level
          </button>
        )}
      </div>
    </div>
  );
}
