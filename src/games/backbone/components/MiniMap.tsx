import { type LevelIndex } from '../logic/graph';
import type { Evaluation } from '../logic/types';
import { loadClass, loadRatio, MAP_HEIGHT, MAP_WIDTH, pointOf } from '../logic/view';

interface MiniMapProps {
  index: LevelIndex;
  evaluation: Evaluation;
  /** The situation whose busiest moment is shown */
  situation: number;
  title: string;
  score: number;
  /** Marks the plan of the player */
  you?: boolean;
  /** Shown instead of the picture, for the best plan before the level is solved */
  locked?: boolean;
}

/** How full every link got in a situation: the highest load of any step. */
function peakLoads(evaluation: Evaluation, situation: number): Map<string, number> {
  const peak = new Map<string, number>();
  for (const step of evaluation.situations[situation]?.steps ?? []) {
    for (const [id, result] of Object.entries(step.links)) {
      peak.set(id, Math.max(peak.get(id) ?? 0, loadRatio(result)));
    }
  }
  return peak;
}

/** A small picture of a plan: the links colored by how full they got, and its score. */
export function MiniMap({
  index,
  evaluation,
  situation,
  title,
  score,
  you = false,
  locked = false,
}: MiniMapProps) {
  const peak = peakLoads(evaluation, situation);
  const { level } = index;
  return (
    <figure className="bb-mini" data-you={you} data-locked={locked}>
      <svg
        viewBox={`0 0 ${String(MAP_WIDTH)} ${String(MAP_HEIGHT)}`}
        className="bb-mini-svg"
        role="img"
        aria-label={
          locked
            ? `${title}: locked until you earn a star`
            : `${title}: score ${String(Math.round(score * 100))}`
        }
      >
        {!locked &&
          level.links.map((link) => {
            const a = level.nodes.find((node) => node.id === link.a);
            const b = level.nodes.find((node) => node.id === link.b);
            if (a === undefined || b === undefined) {
              return null;
            }
            const from = pointOf(a);
            const to = pointOf(b);
            return (
              <line
                key={link.id}
                className="bb-mini-link"
                data-load={loadClass(peak.get(link.id) ?? 0)}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                strokeWidth={1 + link.capacity * 0.28}
              />
            );
          })}
        {!locked &&
          level.nodes.map((node) => {
            const point = pointOf(node);
            return (
              <circle key={node.id} className="bb-mini-node" cx={point.x} cy={point.y} r={2.6} />
            );
          })}
        {locked && (
          <text className="bb-mini-lock" x={MAP_WIDTH / 2} y={MAP_HEIGHT / 2} textAnchor="middle">
            <tspan x={MAP_WIDTH / 2}>Earn a star</tspan>
            <tspan x={MAP_WIDTH / 2} dy="9">
              to see it
            </tspan>
          </text>
        )}
      </svg>
      <figcaption>
        <span>{title}</span>
        <strong>{locked ? '—' : Math.round(score * 100)}</strong>
      </figcaption>
    </figure>
  );
}
