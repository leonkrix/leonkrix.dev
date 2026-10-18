import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LevelRecord } from '../data/pool';
import { loadBalancedPlan, shortestPathPlan } from '../logic/baselines';
import {
  applyStrategy,
  cancelDraft,
  clickNode,
  type PlayState,
  readyToRun,
  redo,
  resetPlan,
  selectFlow,
  startState,
  stepBack,
  undo,
  unrouted,
} from '../logic/play';
import { evaluate } from '../logic/simulate';
import { starsFor, starThresholds } from '../logic/stars';
import { linkName } from '../logic/text';
import type { Evaluation } from '../logic/types';
import { advanceClock, type Clock, nodesOfLinks, packetsAt } from '../logic/view';
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
  next: LevelRecord | undefined;
  onStars: (stars: 0 | 1 | 2 | 3) => void;
  onOpen: (id: string) => void;
}

interface Run {
  evaluation: Evaluation;
  assisted: boolean;
}

/** One level: planning, running the stress test and looking at the result. */
export function Round({ record, chapterRule, solved, next, onStars, onOpen }: RoundProps) {
  const [play, setPlay] = useState<PlayState>(() => startState(record.level));
  const [run, setRun] = useState<Run | undefined>();
  const [clock, setClock] = useState<Clock>({ situation: 0, step: 0, time: STILL_TIME });
  const [playing, setPlaying] = useState(false);
  const [focused, setFocused] = useState(record.level.nodes[0]?.id ?? '');
  const [justSolved, setJustSolved] = useState(false);
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
  const ghosts = useMemo(
    () => ({
      shortest: evaluate(index, shortestPathPlan(index)),
      balanced: evaluate(index, loadBalancedPlan(index)),
      best: evaluate(index, record.best.plan),
    }),
    [index, record],
  );

  // The loads of the plan so far on a quiet day: feedback while planning
  const preview = useMemo(
    () => evaluate(index, play.plan).situations[0]?.steps[0],
    [index, play.plan],
  );

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
  const status =
    run !== undefined
      ? `Stress test of ${level.title}`
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
            routes={routes}
            packets={packets}
            source={run === undefined ? selectedFlow?.source : undefined}
            target={run === undefined ? selectedFlow?.target : undefined}
            draft={play.draft?.nodes}
            focused={focused}
            onFocus={setFocused}
            onNode={(node) => {
              if (run === undefined) {
                setPlay(clickNode(play, node));
              }
            }}
            editable={run === undefined}
          />
          <p className="bb-status" role="status">
            {status}
          </p>
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
                  onClick={() => {
                    setPlay(applyStrategy(play, 'shortest'));
                  }}
                >
                  Shortest for all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlay(applyStrategy(play, 'balanced'));
                  }}
                >
                  Balance for me
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
                {chapterRule !== undefined && (
                  <p className="bb-rule">
                    <strong>New:</strong> {chapterRule}
                  </p>
                )}
              </div>
              <FlowList
                state={play}
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
              shortest={ghosts.shortest}
              balanced={ghosts.balanced}
              best={ghosts.best}
              baselines={{
                shortest: record.shortest,
                balanced: record.balanced,
                best: record.best.score,
              }}
              thresholds={thresholds}
              assisted={run.assisted}
              situation={clock.situation}
              solved={solved || justSolved}
              isLast={next === undefined}
              onEdit={onEdit}
              onNext={() => {
                if (next !== undefined) {
                  onOpen(next.id);
                }
              }}
              onLoadBest={() => {
                setPlay({ ...applyStrategy(play, 'shortest'), plan: record.best.plan });
                onEdit();
              }}
            />
          )}
        </aside>
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
