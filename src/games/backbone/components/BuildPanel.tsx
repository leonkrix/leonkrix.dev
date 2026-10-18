import { costOf, optionalLinks } from '../logic/build';
import { budgetLeft, type PlayState, toggleBuild } from '../logic/play';

interface BuildPanelProps {
  state: PlayState;
  onChange: (next: PlayState) => void;
}

/** The budget and the cables that can be built (chapter 7): build one, or take it away again. */
export function BuildPanel({ state, onChange }: BuildPanelProps) {
  const links = optionalLinks(state.base);
  if (links.length === 0) {
    return null;
  }
  const budget = state.base.budget ?? 0;
  const left = budgetLeft(state);
  const names = new Map(state.base.nodes.map((node) => [node.id, node.name]));
  return (
    <div className="bb-budget">
      <p className="bb-option-label">
        Budget: {left} of {budget} left
      </p>
      <span className="bb-budget-bar" aria-hidden="true">
        <span
          style={{ width: `${String(Math.round(((budget - left) / Math.max(budget, 1)) * 100))}%` }}
        />
      </span>
      <ul className="bb-cables" aria-label="Cables that can be built">
        {links.map((link) => {
          const built = state.built.includes(link.id);
          return (
            <li key={link.id} className="bb-cable" data-built={built}>
              <span className="bb-cable-name">
                {names.get(link.a)} – {names.get(link.b)} · capacity {link.capacity} · cost{' '}
                {costOf(link)}
              </span>
              <button
                type="button"
                disabled={!built && costOf(link) > left}
                onClick={() => {
                  onChange(toggleBuild(state, link.id));
                }}
              >
                {built ? 'Remove' : 'Build'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
