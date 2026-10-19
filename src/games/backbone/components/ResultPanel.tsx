import { type LevelIndex } from '../logic/graph';
import { type Baselines, pointsOf, starsFor, type Thresholds } from '../logic/stars';
import { describeBusiest, summarize } from '../logic/text';
import type { Evaluation, Plan } from '../logic/types';
import { MiniMap } from './MiniMap';
import { Star } from './Svg';

interface ResultPanelProps {
  /** The network of the plan of the player */
  index: LevelIndex;
  /** The network the two simple strategies built, and the one the best plan built */
  simpleIndex: LevelIndex;
  bestIndex: LevelIndex;
  you: Evaluation;
  shortest: Evaluation;
  balanced: Evaluation;
  best: Evaluation;
  baselines: Baselines;
  thresholds: Thresholds;
  assisted: boolean;
  /** The plan that was run (what the player held back is told from it) */
  plan: Plan;
  /** The situation whose pictures are shown */
  situation: number;
  /** The level has been solved (one star or more) in this visit, so the best plan may be shown */
  solved: boolean;
  /** The flow whose routes the map shows (the table lets the player pick one) */
  focus: string | undefined;
  onFocus: (flow: string | undefined) => void;
}

function points(score: number): string {
  return String(pointsOf(score));
}

/** What the stars mean, said exactly: a tie with a simple strategy is a tie, not "better". */
function verdictOf(stars: number, you: number, baselines: Baselines): string {
  const same = (other: number): boolean => pointsOf(you) === pointsOf(other);
  if (stars === 3) {
    return same(baselines.best) ? 'As good as the best plan.' : 'Within reach of the best plan.';
  }
  if (stars === 2) {
    return 'Better than both simple strategies.';
  }
  if (stars === 1) {
    if (same(baselines.shortest)) {
      return 'As good as the shortest path, no better. That is the first star.';
    }
    if (same(baselines.balanced)) {
      return 'As good as the load balanced strategy, and better than the shortest path.';
    }
    return 'Better than the shortest path. The load balanced strategy is still ahead or level.';
  }
  return 'Not yet as good as everybody taking the shortest path.';
}

export function ResultPanel({
  index,
  simpleIndex,
  bestIndex,
  you,
  shortest,
  balanced,
  best,
  baselines,
  thresholds,
  assisted,
  plan,
  situation,
  solved,
  focus,
  onFocus,
}: ResultPanelProps) {
  const stars = assisted ? 0 : starsFor(you.score, thresholds);
  const summary = summarize(index, you);
  const worst = summary.worstFlow;
  const names = new Map(index.level.flows.map((flow) => [flow.id, flow.name]));
  const flowNumber = (id: string): number =>
    index.level.flows.findIndex((flow) => flow.id === id) + 1;
  const overloaded = summary.busiest !== undefined && summary.busiest.ratio > 1 + 1e-9;
  const struggled = overloaded || worst !== undefined;
  const worstSituation = [...summary.situations].sort((a, b) => a.score - b.score)[0];
  // As good as the best plan: what is left over is not a fault, nothing better is possible
  const bestAlready = pointsOf(you.score) >= pointsOf(baselines.best) - 1;
  const heldBack = worst === undefined ? undefined : plan[worst.flow]?.throttle;
  return (
    <div className="bb-result">
      <section className="bb-result-block" aria-labelledby="bb-result-you">
        <h2 id="bb-result-you">Your result</h2>
        <div className="bb-score">
          <p className="bb-score-number" aria-live="polite">
            <span className="bb-score-label">Score</span>
            <strong>{points(you.score)}</strong>
            <span className="bb-score-of">of 100</span>
          </p>
          <p
            className="bb-stars"
            role="img"
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
            : verdictOf(stars, you.score, baselines)}
        </p>
        <p className="bb-thresholds">
          Stars at {points(thresholds.one)} · {points(thresholds.two)} · {points(thresholds.three)}
        </p>
        {summary.situations.length > 1 && (
          <table className="bb-situations">
            <caption className="bb-sr">The score of every situation</caption>
            <tbody>
              {summary.situations.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row">
                    {entry.name}
                    {entry.id === worstSituation?.id && <small> counts twice</small>}
                  </th>
                  <td>
                    <span className="bb-bar" aria-hidden="true">
                      <span style={{ width: `${String(Math.round(entry.score * 100))}%` }} />
                    </span>
                    {points(entry.score)}
                  </td>
                </tr>
              ))}
              <tr className="bb-situations-total">
                <th scope="row">Total</th>
                <td>{points(you.score)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <section className="bb-result-block" aria-labelledby="bb-result-problems">
        <h2 id="bb-result-problems">
          {bestAlready && struggled
            ? 'What it costs'
            : struggled
              ? 'Where your plan fell short'
              : 'How your plan held up'}
        </h2>
        <ul className="bb-problems">
          <li data-problem={bestAlready && struggled ? 'info' : overloaded}>
            {describeBusiest(index, summary, bestAlready)}
          </li>
          {worst !== undefined && (
            <li data-problem={bestAlready || (heldBack ?? 1) < 1 ? 'info' : 'true'}>
              Flow {flowNumber(worst.flow)}, {names.get(worst.flow)},{' '}
              {heldBack !== undefined && heldBack < 1
                ? `you hold it back to ${String(Math.round(heldBack * 100))} %, so it earns ${String(Math.round((1 - worst.lost) * 100))} %.`
                : bestAlready
                  ? `earns ${String(Math.round((1 - worst.lost) * 100))} % of what it could. The best plan does not do better.`
                  : `lost ${String(Math.round(worst.lost * 100))} % of what it could have earned.`}
            </li>
          )}
          {worst === undefined && <li data-problem="false">Every flow got what it needed.</li>}
        </ul>
      </section>

      <section className="bb-result-block" aria-labelledby="bb-result-flows">
        <h2 id="bb-result-flows">What each flow earned</h2>
        <p className="bb-result-help">Pick a flow to look at its routes on the map.</p>
        <table className="bb-table">
          <caption className="bb-sr">What each flow earned</caption>
          <thead>
            <tr>
              <th scope="col">Flow</th>
              <th scope="col">Earned</th>
            </tr>
          </thead>
          <tbody>
            {summary.flows.map((entry) => (
              <tr key={entry.flow}>
                <th scope="row">
                  <button
                    type="button"
                    className="bb-row-flow"
                    aria-pressed={focus === entry.flow}
                    onClick={() => {
                      onFocus(focus === entry.flow ? undefined : entry.flow);
                    }}
                  >
                    {flowNumber(entry.flow)} · {names.get(entry.flow)}
                  </button>
                </th>
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
      </section>

      <section className="bb-result-block" aria-labelledby="bb-result-others">
        <h2 id="bb-result-others">Your plan next to the others</h2>
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
            index={simpleIndex}
            evaluation={shortest}
            situation={situation}
            title="Shortest path"
            score={baselines.shortest}
          />
          <MiniMap
            index={simpleIndex}
            evaluation={balanced}
            situation={situation}
            title="Load balanced"
            score={baselines.balanced}
          />
          <MiniMap
            index={bestIndex}
            evaluation={best}
            situation={situation}
            title="Best plan"
            score={baselines.best}
            locked={!solved}
          />
        </div>
        <dl className="bb-strategies">
          <dt>Shortest path</dt>
          <dd>Every flow takes its fastest path. It knows nothing else.</dd>
          <dt>Load balanced</dt>
          <dd>
            The heaviest flows first, each on the one path where the fullest cable ends up the least
            full. It never splits a flow and knows nothing about priorities, delay, loss or a cut
            cable.
          </dd>
          <dt>Best plan</dt>
          <dd>
            The best plan a search proved before you saw the level. It is the best plan there is:
            the search tries every setting of the slider too.
          </dd>
        </dl>
      </section>
    </div>
  );
}
