import {
  addBackup,
  addLane,
  addStage,
  describePath,
  moveShare,
  type PlayState,
  removeBackup,
  removeLane,
  removeStage,
  selectEdit,
  setRedundancy,
  setThrottle,
  stageChoices,
  suggestPath,
} from '../logic/play';
import { profiles } from '../logic/profiles';
import type { Flow, Redundancy } from '../logic/types';
import { Svg } from './Svg';

interface FlowListProps {
  state: PlayState;
  onSelect: (id: string) => void;
}

/** What a flow wants, in a few words, written from its profile. */
export function wantsOf(flow: Flow): string {
  const profile = profiles[flow.profile];
  const parts: string[] = [];
  if (profile.latencyBudget !== undefined && profile.latencyBudget <= 8) {
    parts.push('fast');
  } else if (profile.latencyBudget !== undefined) {
    parts.push('steady');
  }
  if (profile.lossExponent >= 3) {
    parts.push('no loss');
  } else if (profile.lossExponent > 1.2) {
    parts.push('little loss');
  }
  if (profile.queue === 0) {
    parts.push('goes first');
  } else if (profile.queue === 2) {
    parts.push('goes last');
  }
  return parts.join(', ') || 'anything goes';
}

export function FlowList({ state, onSelect }: FlowListProps) {
  const { level } = state.index;
  const names = new Map(level.nodes.map((node) => [node.id, node.name]));
  return (
    <ul className="bb-flows" aria-label="Flows">
      {level.flows.map((flow) => {
        const plan = state.plan[flow.id];
        const lanes = plan?.stages[0]?.paths.length ?? 0;
        const selected = flow.id === state.selected;
        return (
          <li key={flow.id}>
            <button
              type="button"
              className="bb-flow"
              data-profile={flow.profile}
              data-selected={selected}
              data-routed={plan !== undefined}
              aria-pressed={selected}
              onClick={() => {
                onSelect(flow.id);
              }}
            >
              <span className="bb-flow-icon">
                <Svg set="profile" name={flow.profile} />
              </span>
              <span className="bb-flow-text">
                <span className="bb-flow-name">{flow.name}</span>
                <span className="bb-flow-meta">
                  {names.get(flow.source)} → {names.get(flow.target)} ·{' '}
                  {profiles[flow.profile].name}, {flow.demand}
                  /step · {wantsOf(flow)}
                </span>
              </span>
              <span className="bb-flow-state">
                {plan === undefined ? 'no path' : lanes > 1 ? `${String(lanes)} paths` : 'routed'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface OptionsProps {
  state: PlayState;
  /** Applies a move of the player to the play state */
  onChange: (next: PlayState) => void;
}

const REDUNDANCIES: readonly Redundancy[] = [0, 0.25, 0.5];
const THROTTLES: readonly number[] = [1, 0.5, 0.25];

function percent(value: number): string {
  return `${String(Math.round(value * 100))} %`;
}

export function FlowOptions({ state, onChange }: OptionsProps) {
  const flow = state.index.level.flows.find((entry) => entry.id === state.selected);
  const { rules } = state.index.level;
  if (flow === undefined) {
    return <p className="bb-hint">Pick a flow on the left.</p>;
  }
  const plan = state.plan[flow.id];
  const stage = plan?.stages[state.stage];
  const steps = stageChoices(state);
  const editing =
    plan === undefined
      ? undefined
      : state.target === 'backup'
        ? plan.backup
        : stage?.paths[state.lane]?.nodes;

  return (
    <div className="bb-options" data-profile={flow.profile}>
      <p className="bb-options-title">
        <strong>{flow.name}</strong>
        <span className="bb-options-meta"> wants: {wantsOf(flow)}</span>
      </p>

      <div className="bb-option">
        <p className="bb-option-label">Path</p>
        <p className="bb-hint" data-testid="path">
          {editing === undefined
            ? 'Click the nodes from the start to the end, or drag across them.'
            : describePath(state, editing)}
        </p>
        <div className="bb-row">
          <button
            type="button"
            onClick={() => {
              onChange(suggestPath(state));
            }}
          >
            Fastest path
          </button>
        </div>
      </div>

      {rules.split && plan !== undefined && stage !== undefined && (
        <div className="bb-option">
          <p className="bb-option-label">Split</p>
          <div className="bb-row" role="group" aria-label="Paths of the flow">
            {stage.paths.map((entry, at) => (
              <button
                // The paths of a split have no identity of their own, only a position
                // eslint-disable-next-line @eslint-react/no-array-index-key
                key={at}
                type="button"
                className="bb-chip"
                aria-pressed={state.target === 'path' && state.lane === at}
                onClick={() => {
                  onChange(selectEdit(state, state.stage, at, 'path'));
                }}
              >
                Path {at + 1} · {percent(entry.share)}
              </button>
            ))}
            {stage.paths.length < 3 && (
              <button
                type="button"
                onClick={() => {
                  onChange(addLane(state));
                }}
              >
                Add path
              </button>
            )}
          </div>
          {stage.paths.length > 1 && (
            <div className="bb-row">
              <button
                type="button"
                onClick={() => {
                  onChange(moveShare(state, (state.lane + 1) % stage.paths.length, state.lane));
                }}
              >
                +25 % to path {state.lane + 1}
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(removeLane(state));
                }}
              >
                Remove path {state.lane + 1}
              </button>
            </div>
          )}
        </div>
      )}

      {rules.backup && plan !== undefined && (
        <div className="bb-option">
          <p className="bb-option-label">Backup</p>
          <div className="bb-row">
            {plan.backup === undefined ? (
              <button
                type="button"
                onClick={() => {
                  onChange(addBackup(state));
                }}
              >
                Add a backup path
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="bb-chip"
                  aria-pressed={state.target === 'backup'}
                  onClick={() => {
                    onChange(
                      selectEdit(
                        state,
                        state.stage,
                        state.lane,
                        state.target === 'backup' ? 'path' : 'backup',
                      ),
                    );
                  }}
                >
                  Edit the backup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(removeBackup(state));
                  }}
                >
                  Remove it
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {rules.redundancy && plan !== undefined && (
        <div className="bb-option">
          <p className="bb-option-label">Extra packets (redundancy)</p>
          <div className="bb-row" role="group" aria-label="Redundancy">
            {REDUNDANCIES.map((value) => (
              <button
                key={value}
                type="button"
                className="bb-chip"
                aria-pressed={plan.redundancy === value}
                onClick={() => {
                  onChange(setRedundancy(state, value));
                }}
              >
                {percent(value)}
              </button>
            ))}
          </div>
        </div>
      )}

      {rules.throttle && plan !== undefined && profiles[flow.profile].throttlable && (
        <div className="bb-option">
          <p className="bb-option-label">Send at most</p>
          <div className="bb-row" role="group" aria-label="Throttle">
            {THROTTLES.map((value) => (
              <button
                key={value}
                type="button"
                className="bb-chip"
                aria-pressed={plan.throttle === value}
                onClick={() => {
                  onChange(setThrottle(state, value));
                }}
              >
                {percent(value)}
              </button>
            ))}
          </div>
        </div>
      )}

      {rules.stages && plan !== undefined && steps.length > 0 && (
        <div className="bb-option">
          <p className="bb-option-label">Change the path at a step</p>
          <div className="bb-row" role="group" aria-label="Stages">
            {plan.stages.map((entry, at) => (
              <button
                key={entry.from}
                type="button"
                className="bb-chip"
                aria-pressed={state.stage === at && state.target === 'path'}
                onClick={() => {
                  onChange(selectEdit(state, at, 0, 'path'));
                }}
              >
                {at === 0 ? 'From the start' : `From step ${String(entry.from)}`}
              </button>
            ))}
          </div>
          <div className="bb-row">
            {steps
              .filter((step) => !plan.stages.some((entry) => entry.from === step))
              .map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    onChange(addStage(state, step));
                  }}
                >
                  New path from step {step}
                </button>
              ))}
            {state.stage > 0 && (
              <button
                type="button"
                onClick={() => {
                  onChange(removeStage(state));
                }}
              >
                Remove this change
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
