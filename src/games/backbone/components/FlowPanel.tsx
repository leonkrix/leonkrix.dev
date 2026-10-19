import { useState } from 'react';

import { THROTTLE_STEPS } from '../logic/options';
import {
  addBackup,
  addLane,
  addStage,
  donorOf,
  moveShare,
  type PlayState,
  removeBackup,
  removeFlowPlan,
  removeLane,
  removeStage,
  selectEdit,
  setRedundancy,
  setThrottle,
  stageChoices,
  suggestPath,
} from '../logic/play';
import { profiles } from '../logic/profiles';
import { describeSwitch } from '../logic/text';
import type { Flow, Level, Redundancy } from '../logic/types';
import { Svg } from './Svg';

interface FlowListProps {
  state: PlayState;
  /** Flows a hint points at */
  hinted: ReadonlySet<string>;
  onSelect: (id: string) => void;
}

/**
 * What a flow wants, in a few words, written from its profile. Only what the player has been
 * taught is named: speed when the level has traffic that must be fast (from the chapter about
 * latency), loss from the chapter about loss, and who goes first from the chapter about
 * priorities. An empty text means there is nothing special to say.
 */
export function wantsOf(flow: Flow, level: Level): string {
  const profile = profiles[flow.profile];
  const parts: string[] = [];
  const hasFast = level.flows.some((entry) => {
    const budget = profiles[entry.profile].latencyBudget;
    return budget !== undefined && budget <= 8;
  });
  if (hasFast && profile.latencyBudget !== undefined) {
    parts.push(profile.latencyBudget <= 8 ? 'fast' : 'steady');
  }
  if (level.rules.redundancy) {
    if (profile.lossExponent >= 3) {
      parts.push('no loss');
    } else if (profile.lossExponent > 1.2) {
      parts.push('little loss');
    }
  }
  if (level.rules.throttle) {
    if (profile.queue === 0) {
      parts.push('goes first');
    } else if (profile.queue === 2) {
      parts.push('goes last');
    }
  }
  return parts.join(', ');
}

export function FlowList({ state, hinted, onSelect }: FlowListProps) {
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
              data-hint={hinted.has(flow.id)}
              data-routed={plan !== undefined}
              aria-pressed={selected}
              onClick={() => {
                onSelect(flow.id);
              }}
            >
              <span className="bb-flow-icon">
                <Svg set="profile" name={flow.profile} />
                <span className="bb-flow-number" aria-hidden="true">
                  {level.flows.indexOf(flow) + 1}
                </span>
              </span>
              <span className="bb-flow-text">
                <span className="bb-flow-name">
                  <span className="bb-sr">Flow {level.flows.indexOf(flow) + 1}: </span>
                  {flow.name}
                </span>
                <span className="bb-flow-meta">
                  {names.get(flow.source)} → {names.get(flow.target)}
                </span>
                <span className="bb-flow-meta">
                  {profiles[flow.profile].name} · sends {flow.demand} per minute
                  {wantsOf(flow, level) !== '' && ` · ${wantsOf(flow, level)}`}
                </span>
                {(flow.via ?? []).length > 0 && (
                  <span className="bb-flow-meta bb-flow-policy">
                    Must pass: {(flow.via ?? []).map((node) => names.get(node) ?? node).join(', ')}
                  </span>
                )}
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

/** The route of a flow as a row of chips, one for every node, and a hint while it is drawn. */
function RouteChips({
  state,
  flow,
  path,
}: {
  state: PlayState;
  flow: Flow;
  path: readonly string[] | undefined;
}) {
  const nodes = new Map(state.index.level.nodes.map((node) => [node.id, node]));
  const names = new Map(state.index.level.nodes.map((node) => [node.id, node.name]));
  const drawing = state.draft?.nodes;
  const shown = drawing ?? path;
  if (shown === undefined) {
    return (
      <p className="bb-hint">
        Click the nodes from {names.get(flow.source)} to {names.get(flow.target)}, or drag across
        them.
      </p>
    );
  }
  return (
    <>
      <ol
        className="bb-route-chips"
        data-drawing={drawing !== undefined}
        aria-label="Nodes of the route"
      >
        {shown.map((node, at) => {
          const kind = nodes.get(node)?.kind;
          return (
            <li key={node}>
              {at > 0 && <span aria-hidden="true">→</span>}
              <span
                className="bb-route-chip"
                data-end={node === flow.source || node === flow.target}
              >
                {kind !== undefined && <Svg set="node" name={kind} className="bb-chip-icon" />}
                {names.get(node) ?? node}
              </span>
            </li>
          );
        })}
        {drawing !== undefined && (
          <li aria-hidden="true">
            <span>→</span>
            <span className="bb-route-chip" data-open>
              …
            </span>
          </li>
        )}
      </ol>
      {drawing !== undefined && (
        <p className="bb-hint">Now click the next node, up to {names.get(flow.target)}.</p>
      )}
    </>
  );
}

interface OptionsProps {
  state: PlayState;
  /** Applies a move of the player to the play state */
  onChange: (next: PlayState) => void;
}

const REDUNDANCIES: readonly Redundancy[] = [0, 0.25, 0.5];

function percent(value: number): string {
  return `${String(Math.round(value * 100))} %`;
}

/**
 * How much of its traffic a flow may send, from 10 to 100 % in steps of 10 (the values the solver
 * of the best plan chooses from, `THROTTLE_STEPS`). The value follows the
 * slider while it is moved and is set in the plan when it is let go (one step to undo, not twenty).
 */
function ThrottleSlider({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [moving, setMoving] = useState<number | undefined>();
  const shown = moving ?? Math.round(value * 100);
  const commit = (): void => {
    if (moving !== undefined) {
      setMoving(undefined);
      if (moving !== Math.round(value * 100)) {
        onCommit(moving / 100);
      }
    }
  };
  return (
    <div className="bb-option">
      <label className="bb-option-label" htmlFor="bb-throttle">
        Send at most
      </label>
      <div className="bb-slider">
        <input
          id="bb-throttle"
          type="range"
          min={Math.round(Math.min(...THROTTLE_STEPS) * 100)}
          max={100}
          step={Math.round((THROTTLE_STEPS[0] ?? 1) * 100 - (THROTTLE_STEPS[1] ?? 0.9) * 100)}
          value={shown}
          aria-valuetext={`${String(shown)} percent of its traffic`}
          onChange={(event) => {
            setMoving(Number(event.target.value));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
        <output htmlFor="bb-throttle">{shown} %</output>
      </div>
    </div>
  );
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
      <div className="bb-options-head">
        <span className="bb-flow-icon">
          <Svg set="profile" name={flow.profile} />
          <span className="bb-flow-number" aria-hidden="true">
            {state.index.level.flows.indexOf(flow) + 1}
          </span>
        </span>
        <div>
          <h3 className="bb-options-title">
            <span className="bb-sr">Flow {state.index.level.flows.indexOf(flow) + 1}: </span>
            {flow.name}
          </h3>
          {wantsOf(flow, state.index.level) !== '' && (
            <p className="bb-options-meta">Needs: {wantsOf(flow, state.index.level)}</p>
          )}
        </div>
      </div>

      <div className="bb-option">
        <p className="bb-option-label">
          Route
          {plan !== undefined && state.target === 'backup' && ' (backup)'}
          {plan !== undefined &&
            state.target === 'path' &&
            (stage?.paths.length ?? 1) > 1 &&
            ` (path ${String(state.lane + 1)})`}
          {plan !== undefined &&
            state.target === 'path' &&
            state.stage > 0 &&
            ` (from minute ${String((stage?.from ?? 0) + 1)})`}
        </p>
        <RouteChips state={state} flow={flow} path={editing} />
        <div className="bb-row">
          <button
            type="button"
            onClick={() => {
              onChange(suggestPath(state));
            }}
          >
            Use the fastest route
          </button>
          {plan !== undefined && (
            <button
              type="button"
              onClick={() => {
                onChange(removeFlowPlan(state));
              }}
            >
              Remove route
            </button>
          )}
        </div>
      </div>

      {rules.split && plan !== undefined && stage !== undefined && (
        <div className="bb-option">
          <p className="bb-option-label">Paths</p>
          <ul className="bb-paths" aria-label="Paths of the flow">
            {stage.paths.map((entry, at) => {
              const donor = donorOf(state, at);
              const selected = state.target === 'path' && state.lane === at;
              return (
                // The paths of a split have no identity of their own, only a position
                // eslint-disable-next-line @eslint-react/no-array-index-key
                <li key={at} data-selected={selected}>
                  <button
                    type="button"
                    className="bb-path-pick"
                    aria-pressed={selected}
                    onClick={() => {
                      onChange(selectEdit(state, state.stage, at, 'path'));
                    }}
                  >
                    <span className="bb-path-name">Path {at + 1}</span>
                    <span className="bb-path-share">{percent(entry.share)}</span>
                  </button>
                  <span className="bb-path-actions">
                    <button
                      type="button"
                      className="bb-small"
                      disabled={donor === undefined}
                      aria-label={`Give path ${String(at + 1)} a quarter more`}
                      onClick={() => {
                        if (donor !== undefined) {
                          onChange(moveShare(state, donor, at));
                        }
                      }}
                    >
                      +25 %
                    </button>
                    <button
                      type="button"
                      className="bb-small"
                      disabled={stage.paths.length < 2}
                      aria-label={`Remove path ${String(at + 1)}`}
                      onClick={() => {
                        onChange(removeLane(selectEdit(state, state.stage, at, 'path')));
                      }}
                    >
                      <Svg set="ui" name="trash" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          {stage.paths.length < 3 && (
            <button
              type="button"
              className="bb-add"
              onClick={() => {
                onChange(addLane(state));
              }}
            >
              <Svg set="ui" name="plus" /> Add path
            </button>
          )}
        </div>
      )}

      {rules.backup && plan !== undefined && (
        <div className="bb-option">
          <p className="bb-option-label">Backup</p>
          {plan.backup === undefined ? (
            <button
              type="button"
              className="bb-add"
              onClick={() => {
                onChange(addBackup(state));
              }}
            >
              <Svg set="ui" name="plus" /> Add a backup path
            </button>
          ) : (
            <ul className="bb-paths" aria-label="Backup of the flow">
              <li data-selected={state.target === 'backup'}>
                <button
                  type="button"
                  className="bb-path-pick"
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
                  <span className="bb-path-name">Backup path</span>
                  <span className="bb-path-share">takes over when a cable is cut</span>
                </button>
                <span className="bb-path-actions">
                  <button
                    type="button"
                    className="bb-small"
                    aria-label="Remove the backup path"
                    onClick={() => {
                      onChange(removeBackup(state));
                    }}
                  >
                    <Svg set="ui" name="trash" />
                  </button>
                </span>
              </li>
            </ul>
          )}
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
        <ThrottleSlider
          key={flow.id}
          value={plan.throttle}
          onCommit={(value) => {
            onChange(setThrottle(state, value));
          }}
        />
      )}

      {rules.stages && plan !== undefined && steps.length > 0 && (
        <div className="bb-option">
          <p className="bb-option-label">Another route during the stress test</p>
          <p className="bb-hint">
            The stress test runs minute by minute (the bar under the map). From a minute on, this
            flow can take another route, for example when a cable is cut. Pick a minute below: what
            happens in that minute is written in brackets. Then draw the new route on the map.
          </p>
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
                {at === 0 ? 'Normal route' : `From minute ${String(entry.from + 1)}`}
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
                  Reroute from minute {step + 1}
                  {describeSwitch(state.index, step) !== '' &&
                    ` (${describeSwitch(state.index, step)})`}
                </button>
              ))}
            {state.stage > 0 && (
              <button
                type="button"
                onClick={() => {
                  onChange(removeStage(state));
                }}
              >
                Remove the change
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
