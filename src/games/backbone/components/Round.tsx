import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LevelRecord } from '../data/pool';
import { loadBalancedPlan, shortestPathPlan } from '../logic/baselines';
import { optionalLinks, simpleBuild, withBuilt } from '../logic/build';
import { indexLevel } from '../logic/graph';
import { hintFor } from '../logic/hint';
import { placeNames, placeTag } from '../logic/labels';
import {
  applyStrategy,
  budgetLeft,
  cancelDraft,
  clickNode,
  loadDesign,
  type PlayState,
  readyToRun,
  redo,
  resetPlan,
  selectFlow,
  startState,
  stepBack,
  toggleBuild,
  undo,
  unrouted,
} from '../logic/play';
import { evaluate } from '../logic/simulate';
import { starsFor, starThresholds } from '../logic/stars';
import { linkName } from '../logic/text';
import type { Evaluation, LinkStepResult } from '../logic/types';
import { advanceClock, type Clock, linkBetween, nodesOfLinks, packetsAt } from '../logic/view';
import { BuildPanel } from './BuildPanel';
import { FlowList, FlowOptions } from './FlowPanel';
import { type DrawnRoute, MapView } from './MapView';
import { ResultPanel } from './ResultPanel';
import { Svg } from './Svg';
import { Timeline } from './Timeline';

/** How long one step of the stress test plays, in milliseconds */
const STEP_MS = 1100;
/** Where the packets stand in a still frame (reduced motion) */
const STILL_TIME = 0.3;

interface RoundProps {
  record: LevelRecord;
  /** The new rule of the chapter, shown on the first level of it */
  chapterRule: string | undefined;
  /** The level was solved earlier in this visit */
  solved: boolean;
  /** What the result offers after the level: the next level, or another random one */
  next: { label: string; onClick: () => void } | undefined;
  onStars: (stars: 0 | 1 | 2 | 3) => void;
}

interface Run {
  evaluation: Evaluation;
  assisted: boolean;
}

/** One level: planning, running the stress test and looking at the result. */
export function Round({ record, chapterRule, solved, next, onStars }: RoundProps) {
  const [play, setPlay] = useState<PlayState>(() => startState(record.level));
  const [run, setRun] = useState<Run | undefined>();
  const [clock, setClock] = useState<Clock>({ situation: 0, step: 0, time: STILL_TIME });
  const [playing, setPlaying] = useState(false);
  const [focused, setFocused] = useState(record.level.nodes[0]?.id ?? '');
  const [justSolved, setJustSolved] = useState(false);
  const [hover, setHover] = useState<string | undefined>();
  // The flow the result looks at (picked in its table)
  const [focusFlow, setFocusFlow] = useState<string | undefined>();
  // The hint that was asked for, and the plan it was asked for: a change of the plan ends it
  const [asked, setAsked] = useState<
    { plan: PlayState['plan']; built: PlayState['built']; stage: 1 | 2 | 3 } | undefined
  >();
  const reducedRef = useRef(false);
  const clockRef = useRef(clock);

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const { index } = play;
  const { level } = index;
  const phase = run === undefined ? 'route' : 'stress';
  const thresholds = useMemo(
    () =>
      starThresholds({
        shortest: record.shortest,
        balanced: record.balanced,
        best: record.best.score,
      }),
    [record],
  );
  // The two simple strategies build in their own simple way, the best plan builds what it needs
  const designs = useMemo(() => {
    const simpleIndex = indexLevel(withBuilt(record.level, simpleBuild(record.level)));
    const bestIndex = indexLevel(withBuilt(record.level, record.best.built));
    return {
      simpleIndex,
      bestIndex,
      shortest: evaluate(simpleIndex, shortestPathPlan(simpleIndex)),
      balanced: evaluate(simpleIndex, loadBalancedPlan(simpleIndex)),
      best: evaluate(bestIndex, record.best.plan),
    };
  }, [record]);

  // The loads of the plan so far on a quiet day: feedback while planning
  const preview = useMemo(
    () => evaluate(index, play.plan).situations[0]?.steps[0],
    [index, play.plan],
  );

  // The names scale with the map (see `.bb-map > *` in the style), so one placement holds for every width
  const placement = useMemo(() => placeNames(record.level), [record.level]);

  // The loads of the quiet day without the selected flow: what a new path for it adds to
  const withoutSelected = useMemo(() => {
    const rest = Object.fromEntries(
      Object.entries(play.plan).filter(([id]) => id !== play.selected),
    );
    return evaluate(index, rest).situations[0]?.steps[0]?.links;
  }, [index, play.plan, play.selected]);

  // A forecast for the path being drawn: the load every cable on it would have
  const forecast = useMemo(() => {
    const flow = level.flows.find((entry) => entry.id === play.selected);
    const drawn = play.draft?.nodes;
    if (flow === undefined || drawn === undefined || withoutSelected === undefined) {
      return {};
    }
    const last = drawn[drawn.length - 1];
    const candidate =
      hover !== undefined &&
      last !== undefined &&
      !drawn.includes(hover) &&
      linkBetween(level, last, hover) !== undefined
        ? [...drawn, hover]
        : drawn;
    const result: Record<string, LinkStepResult> = {};
    for (let at = 1; at < candidate.length; at += 1) {
      const id = linkBetween(level, candidate[at - 1] ?? '', candidate[at] ?? '');
      const base = id === undefined ? undefined : withoutSelected[id];
      if (id !== undefined && base !== undefined) {
        result[id] = { ...base, offered: base.offered + flow.demand };
      }
    }
    return result;
  }, [level, play.draft, play.selected, withoutSelected, hover]);

  // Plays the stress test: step after step, situation after situation
  useEffect(() => {
    if (!playing) {
      return;
    }
    const stepsOf = level.situations.map((situation) => situation.steps);
    let last = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const delta = now - last;
      last = now;
      const moved = advanceClock(stepsOf, clockRef.current, delta / STEP_MS);
      clockRef.current = moved.clock;
      setClock(moved.clock);
      if (moved.finished) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [playing, level]);

  const moveClock = useCallback((to: Clock) => {
    clockRef.current = to;
    setClock(to);
  }, []);

  const onRun = (): void => {
    const evaluation = evaluate(index, play.plan);
    const earned = play.assisted ? 0 : starsFor(evaluation.score, thresholds);
    setRun({ evaluation, assisted: play.assisted });
    onStars(earned);
    setJustSolved(earned > 0);
    moveClock({ situation: 0, step: 0, time: reducedRef.current ? STILL_TIME : 0 });
    setPlaying(!reducedRef.current);
  };

  const onEdit = (): void => {
    setFocusFlow(undefined);
    setRun(undefined);
    setPlaying(false);
  };

  // What the map draws
  const stressStep = run?.evaluation.situations[clock.situation]?.steps[clock.step];
  const selectedFlow = level.flows.find((flow) => flow.id === play.selected);
  const routes: DrawnRoute[] = [];
  if (run === undefined) {
    for (const flow of level.flows) {
      const flowPlan = play.plan[flow.id];
      if (flowPlan === undefined) {
        continue;
      }
      const isSelected = flow.id === play.selected;
      const stage = isSelected
        ? (flowPlan.stages[play.stage] ?? flowPlan.stages[0])
        : flowPlan.stages[0];
      stage?.paths.forEach((path, lane) => {
        routes.push({
          flow: flow.id,
          nodes: path.nodes,
          share: path.share,
          active: isSelected && play.target === 'path' && lane === play.lane,
        });
      });
      if (isSelected && flowPlan.backup !== undefined) {
        routes.push({
          flow: flow.id,
          nodes: flowPlan.backup,
          share: 0.5,
          active: play.target === 'backup',
          backup: true,
        });
      }
    }
  } else if (stressStep !== undefined) {
    for (const flow of level.flows) {
      for (const used of stressStep.flows[flow.id]?.paths ?? []) {
        routes.push({
          flow: flow.id,
          nodes: nodesOfLinks(index, flow.source, used.links),
          share: used.share,
          active: false,
        });
      }
    }
  }
  const packets =
    stressStep === undefined
      ? []
      : packetsAt(index, stressStep, reducedRef.current ? STILL_TIME : clock.time);
  const loads = run === undefined ? preview?.links : stressStep?.links;

  const missing = unrouted(play);
  const hint =
    run === undefined && asked?.plan === play.plan && asked.built === play.built
      ? hintFor(
          play,
          { plan: record.best.plan, built: record.best.built, score: record.best.score },
          asked.stage,
        )
      : undefined;
  const askForHint = (): void => {
    const stage = asked?.plan === play.plan && asked.built === play.built ? asked.stage : 0;
    const next = Math.min(3, stage + 1) as 1 | 2 | 3;
    const given = hintFor(
      play,
      { plan: record.best.plan, built: record.best.built, score: record.best.score },
      next,
    );
    setAsked({ plan: play.plan, built: play.built, stage: next });
    // A hint that tells what to do is help: a run after it earns no stars
    if (given.givesAway && !play.assisted) {
      setPlay({ ...play, assisted: true });
    }
  };
  const status =
    hint !== undefined
      ? `Hint ${String(hint.stage)} of 3${hint.givesAway ? ' (no stars this run)' : ''}: ${hint.text}`
      : run !== undefined
        ? `Stress test of “${level.title}”`
        : play.message !== ''
          ? play.message
          : missing.length > 0
            ? `${String(missing.length)} flow${missing.length === 1 ? '' : 's'} still need${missing.length === 1 ? 's' : ''} a path.`
            : 'Every flow has a path. Run the stress test when you are ready.';

  return (
    // The keys bubble up from the nodes and buttons inside, which are the interactive elements
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="bb"
      data-phase={phase}
      onKeyDown={(event) => {
        if (run !== undefined) {
          return;
        }
        if (event.key === 'Escape') {
          setPlay(cancelDraft(play));
        } else if (event.key === 'Backspace' && play.draft !== undefined) {
          event.preventDefault();
          setPlay(stepBack(play));
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          setPlay(event.shiftKey ? redo(play) : undo(play));
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          setPlay(redo(play));
        }
      }}
    >
      <div className="bb-stage">
        <div className="bb-left">
          <MapView
            index={index}
            loads={loads}
            forecast={forecast}
            hinted={new Set(hint?.links ?? [])}
            emphasis={run === undefined ? play.selected : focusFlow}
            routes={routes}
            packets={packets}
            source={run === undefined ? selectedFlow?.source : undefined}
            target={run === undefined ? selectedFlow?.target : undefined}
            nameSides={placement.names}
            lifted={placement.lifted}
            badgesLeft={placement.badgesLeft}
            loadAt={placement.loads}
            sourceSide={
              selectedFlow === undefined
                ? 'above'
                : placeTag(record.level, placement, selectedFlow.source)
            }
            targetSide={
              selectedFlow === undefined
                ? 'above'
                : placeTag(record.level, placement, selectedFlow.target)
            }
            draft={play.draft?.nodes}
            focused={focused}
            onFocus={setFocused}
            onHover={setHover}
            onNode={(node) => {
              if (run === undefined) {
                setPlay(clickNode(play, node));
              }
            }}
            editable={run === undefined}
            unbuilt={optionalLinks(play.base).filter((link) => !play.built.includes(link.id))}
            budgetLeft={budgetLeft(play)}
            onBuild={(id) => {
              setPlay(toggleBuild(play, id));
            }}
          />
          <div className="bb-status-row">
            <p className="bb-status" role="status">
              {status}
            </p>
            {run === undefined && (
              <button type="button" className="bb-hint-button" onClick={askForHint}>
                Hint
              </button>
            )}
          </div>
          <div className="bb-under">
            {run === undefined ? (
              <div className="bb-actions">
                <button
                  type="button"
                  disabled={play.past.length === 0}
                  onClick={() => {
                    setPlay(undo(play));
                  }}
                >
                  <Svg set="ui" name="undo-2" /> Undo
                </button>
                <button
                  type="button"
                  disabled={play.future.length === 0}
                  onClick={() => {
                    setPlay(redo(play));
                  }}
                >
                  <Svg set="ui" name="redo-2" /> Redo
                </button>
                <button
                  type="button"
                  disabled={Object.keys(play.plan).length === 0}
                  onClick={() => {
                    setPlay(resetPlan(play));
                  }}
                >
                  <Svg set="ui" name="rotate-ccw" /> Clear
                </button>
                <button
                  type="button"
                  title="Every flow takes its fastest path. A run like this earns no stars."
                  onClick={() => {
                    setPlay(applyStrategy(play, 'shortest'));
                  }}
                >
                  Auto: shortest
                </button>
                <button
                  type="button"
                  title="Flows are spread over the network one after the other. A run like this earns no stars."
                  onClick={() => {
                    setPlay(applyStrategy(play, 'balanced'));
                  }}
                >
                  Auto: balanced
                </button>
                <button type="button" data-primary disabled={!readyToRun(play)} onClick={onRun}>
                  Run
                </button>
              </div>
            ) : (
              <Timeline
                index={index}
                situation={clock.situation}
                step={clock.step}
                playing={playing}
                onSituation={(situation) => {
                  moveClock({ situation, step: 0, time: reducedRef.current ? STILL_TIME : 0 });
                  setPlaying(false);
                }}
                onStep={(step) => {
                  moveClock({ situation: clock.situation, step, time: STILL_TIME });
                  setPlaying(false);
                }}
                onToggle={() => {
                  const last = (level.situations[clock.situation]?.steps ?? 1) - 1;
                  if (!playing && clock.step >= last) {
                    moveClock({ situation: clock.situation, step: 0, time: 0 });
                  }
                  setPlaying(!playing);
                }}
              />
            )}
          </div>
        </div>

        <div className="bb-right">
          <aside
            className="bb-panel"
            aria-label={run === undefined ? 'Plan' : 'Result'}
            data-layout-fluid
          >
            {run === undefined ? (
              <>
                <div className="bb-brief">
                  <h2>{level.title}</h2>
                  <p>{level.story}</p>
                  {level.zones !== undefined && (
                    <ul className="bb-zones" aria-label="Zones">
                      {level.zones.map((zone) => (
                        <li key={zone.id} data-zone={zone.id}>
                          {zone.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {chapterRule !== undefined && (
                    <p className="bb-rule">
                      <strong>New:</strong> {chapterRule}
                    </p>
                  )}
                </div>
                <BuildPanel state={play} onChange={setPlay} />
                <FlowList
                  state={play}
                  hinted={new Set(hint?.flows ?? [])}
                  onSelect={(id) => {
                    setPlay(selectFlow(play, id));
                  }}
                />
                <FlowOptions state={play} onChange={setPlay} />
              </>
            ) : (
              <ResultPanel
                index={index}
                you={run.evaluation}
                simpleIndex={designs.simpleIndex}
                bestIndex={designs.bestIndex}
                shortest={designs.shortest}
                balanced={designs.balanced}
                best={designs.best}
                baselines={{
                  shortest: record.shortest,
                  balanced: record.balanced,
                  best: record.best.score,
                }}
                thresholds={thresholds}
                assisted={run.assisted}
                situation={clock.situation}
                solved={solved || justSolved}
                onEdit={onEdit}
                focus={focusFlow}
                onFocus={setFocusFlow}
                onLoadBest={() => {
                  setPlay(loadDesign(play, record.best.plan, record.best.built));
                  onEdit();
                }}
              />
            )}
          </aside>
          {/* Under the panel, on the height of the play bar: the way on, once the level is run */}
          <div className="bb-next-row">
            {run !== undefined && next !== undefined && (
              <button type="button" data-primary onClick={next.onClick}>
                {next.label}
              </button>
            )}
          </div>
        </div>
      </div>

      <details className="bb-text">
        <summary>Text version of the network</summary>
        <h3>Cables</h3>
        <table className="bb-table">
          <thead>
            <tr>
              <th scope="col">Cable</th>
              <th scope="col">Capacity</th>
              <th scope="col">Delay</th>
              <th scope="col">Buffer</th>
              <th scope="col">Traffic</th>
              <th scope="col">Loss</th>
            </tr>
          </thead>
          <tbody>
            {level.links.map((link) => (
              <tr key={link.id}>
                <th scope="row">{linkName(index, link.id)}</th>
                <td>{link.capacity}</td>
                <td>{link.delay}</td>
                <td>{index.level.rules.queues ? (link.buffer ?? 0) : 0}</td>
                <td>{Math.round((loads?.[link.id]?.offered ?? 0) * 10) / 10}</td>
                <td>{link.loss > 0 ? `${String(Math.round(link.loss * 100))} %` : 'none'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Flows</h3>
        <ul>
          {level.flows.map((flow) => {
            const flowPlan = play.plan[flow.id];
            const names = new Map(level.nodes.map((node) => [node.id, node.name]));
            const path = (nodes: readonly string[]): string =>
              nodes.map((node) => names.get(node) ?? node).join(', ');
            return (
              <li key={flow.id}>
                {flow.name} ({flow.profile}, {flow.demand} per step) from {names.get(flow.source)}{' '}
                to {names.get(flow.target)}:{' '}
                {flowPlan === undefined
                  ? 'no path yet'
                  : flowPlan.stages
                      .map((stage) =>
                        stage.paths
                          .map(
                            (entry) =>
                              `${path(entry.nodes)} (${String(Math.round(entry.share * 100))} %)`,
                          )
                          .join(' and '),
                      )
                      .join(', then ')}
                {flowPlan?.backup === undefined ? '' : `. Backup: ${path(flowPlan.backup)}`}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
