import { loadBalancedPlan, shortestPathPlan } from './baselines';
import { costOf, optionalLinks, simpleBuild, spent, withBuilt } from './build';
import { fastestRoute, indexLevel, type LevelIndex, linksOfPath } from './graph';
import { switchSteps } from './options';
import { problemsOfPlan, singlePath } from './plan';
import { profiles } from './profiles';
import type {
  Flow,
  FlowPlan,
  Level,
  NetLink,
  NodePath,
  Plan,
  Redundancy,
  RouteStage,
} from './types';

/**
 * The moves of the player, as pure functions on an immutable state. The React component only draws
 * the state and calls these. Nothing here knows about the screen.
 *
 * The plan is always runnable for the flows it contains: a move that would leave a flow with a
 * broken path is refused with a message instead. The only thing in progress is a `draft`, a path
 * the player is drawing node by node; it replaces a path when it reaches the target.
 */

/** What the player edits on the selected flow: one of its paths, or its backup. */
export type Target = 'path' | 'backup';

export interface Draft {
  nodes: NodePath;
}

/** What undo goes back to: the plan and the cables that were built */
export interface Snapshot {
  plan: Plan;
  built: readonly string[];
}

export interface PlayState {
  /** The network as it is now: the level with the cables that are built */
  index: LevelIndex;
  /** The level with all its optional cables, built or not */
  base: Level;
  built: readonly string[];
  plan: Plan;
  selected: string | undefined;
  /** Which stage and which lane (path of a split) the player is editing */
  stage: number;
  lane: number;
  target: Target;
  draft: Draft | undefined;
  past: readonly Snapshot[];
  future: readonly Snapshot[];
  /** True when a helper filled in the plan: the run then earns no stars */
  assisted: boolean;
  /** The last thing worth telling the player, also for the screen reader */
  message: string;
}

const MOST_LANES = 3;
const MOST_HISTORY = 100;

export function startState(level: Level): PlayState {
  return {
    index: indexLevel(withBuilt(level, [])),
    base: level,
    built: [],
    plan: {},
    selected: level.flows[0]?.id,
    stage: 0,
    lane: 0,
    target: 'path',
    draft: undefined,
    past: [],
    future: [],
    assisted: false,
    message: '',
  };
}

function flowOf(state: PlayState, id: string | undefined): Flow | undefined {
  return state.index.level.flows.find((flow) => flow.id === id);
}

function say(state: PlayState, message: string): PlayState {
  return { ...state, message };
}

/** Puts a new plan (and, if given, new cables) in place, remembering the old ones for undo. */
function commit(
  state: PlayState,
  plan: Plan,
  message: string,
  built: readonly string[] = state.built,
): PlayState {
  return {
    ...state,
    index: built === state.built ? state.index : indexLevel(withBuilt(state.base, built)),
    built,
    plan,
    past: [...state.past, { plan: state.plan, built: state.built }].slice(-MOST_HISTORY),
    future: [],
    draft: undefined,
    message,
  };
}

function restore(state: PlayState, snapshot: Snapshot): PlayState {
  return {
    ...state,
    index:
      snapshot.built === state.built
        ? state.index
        : indexLevel(withBuilt(state.base, snapshot.built)),
    built: snapshot.built,
    plan: snapshot.plan,
    draft: undefined,
  };
}

function withFlowPlan(
  state: PlayState,
  flowId: string,
  flowPlan: FlowPlan,
  message: string,
): PlayState {
  return commit(state, { ...state.plan, [flowId]: flowPlan }, message);
}

export function nameOf(state: PlayState, node: string): string {
  return state.index.level.nodes.find((entry) => entry.id === node)?.name ?? node;
}

export function selectFlow(state: PlayState, id: string): PlayState {
  const flow = flowOf(state, id);
  if (flow === undefined) {
    return state;
  }
  return {
    ...state,
    selected: id,
    stage: 0,
    lane: 0,
    target: 'path',
    draft: undefined,
    message: `${flow.name} selected. It goes from ${nameOf(state, flow.source)} to ${nameOf(state, flow.target)}.`,
  };
}

export function selectEdit(
  state: PlayState,
  stage: number,
  lane: number,
  target: Target,
): PlayState {
  const flowPlan = state.selected === undefined ? undefined : state.plan[state.selected];
  const stageCount = flowPlan?.stages.length ?? 1;
  const laneCount = flowPlan?.stages[stage]?.paths.length ?? 1;
  return {
    ...state,
    stage: Math.min(stage, stageCount - 1),
    lane: Math.min(lane, laneCount - 1),
    target,
    draft: undefined,
  };
}

/** The path the player is editing now, if it exists. */
export function editedPath(state: PlayState): NodePath | undefined {
  const flowPlan = state.selected === undefined ? undefined : state.plan[state.selected];
  if (flowPlan === undefined) {
    return undefined;
  }
  return state.target === 'backup'
    ? flowPlan.backup
    : flowPlan.stages[state.stage]?.paths[state.lane]?.nodes;
}

function replaceEditedPath(state: PlayState, flow: Flow, path: NodePath): PlayState {
  // A route that skips a node the flow has to pass (a firewall) is not a route: nothing is set
  const skipped = (flow.via ?? []).filter((node) => !path.includes(node));
  if (skipped.length > 0) {
    return {
      ...state,
      draft: undefined,
      message: `${flow.name} has to pass ${skipped.map((node) => nameOf(state, node)).join(', ')}. That route skips it, so it was not set: draw it again.`,
    };
  }
  const flowPlan = state.plan[flow.id] ?? singlePath(path);
  if (state.target === 'backup') {
    return withFlowPlan(
      state,
      flow.id,
      { ...flowPlan, backup: path },
      `Backup for ${flow.name} set.`,
    );
  }
  const stages = flowPlan.stages.map((stage, stageAt) =>
    stageAt === state.stage
      ? {
          ...stage,
          paths: stage.paths.map((entry, laneAt) =>
            laneAt === state.lane ? { ...entry, nodes: path } : entry,
          ),
        }
      : stage,
  );
  const done = withFlowPlan(
    state,
    flow.id,
    { ...flowPlan, stages },
    `${flow.name} goes ${describePath(state, path)}.`,
  );
  // The first route of a flow is done: go on with the next flow that still has none
  const next = state.plan[flow.id] === undefined ? nextUnrouted(done, flow.id) : undefined;
  if (next === undefined) {
    return done;
  }
  const moved = selectFlow(done, next.id);
  return { ...moved, message: `${done.message} Next: ${moved.message}` };
}

/** The flow after the given one in the list (the list is a circle) that has no route yet. */
function nextUnrouted(state: PlayState, after: string): Flow | undefined {
  const { flows } = state.index.level;
  const start = flows.findIndex((flow) => flow.id === after);
  for (let step = 1; step < flows.length; step += 1) {
    const flow = flows[(start + step) % flows.length];
    if (flow !== undefined && state.plan[flow.id] === undefined) {
      return flow;
    }
  }
  return undefined;
}

export function describePath(state: PlayState, path: NodePath): string {
  return path.map((node) => nameOf(state, node)).join(', ');
}

/** The cable that is not built yet and joins two nodes, if there is one. */
function unbuiltBetween(state: PlayState, a: string, b: string): NetLink | undefined {
  return optionalLinks(state.base).find(
    (link) =>
      !state.built.includes(link.id) &&
      ((link.a === a && link.b === b) || (link.a === b && link.b === a)),
  );
}

/**
 * Builds the cable between two nodes when a route is drawn over it, as long as the budget is
 * enough. The drawing in progress is kept. Without a cable to build the state is returned as it is;
 * when the budget is not enough the state says so.
 */
function buildOnTheWay(state: PlayState, a: string, b: string): PlayState {
  const ghost = unbuiltBetween(state, a, b);
  if (ghost === undefined) {
    return state;
  }
  const built = toggleBuild(state, ghost.id);
  return built.built.includes(ghost.id) ? { ...built, draft: state.draft } : built;
}

/** The player clicks (or taps) a node while drawing a path. */
export function clickNode(state: PlayState, node: string): PlayState {
  const flow = flowOf(state, state.selected);
  if (flow === undefined) {
    return say(state, 'Select a flow first.');
  }
  const draft = state.draft?.nodes;
  if (draft === undefined) {
    if (node !== flow.source) {
      return say(state, `Start at ${nameOf(state, flow.source)}, where ${flow.name} begins.`);
    }
    return { ...state, draft: { nodes: [node] }, message: `Drawing from ${nameOf(state, node)}.` };
  }
  const position = draft.indexOf(node);
  if (position >= 0) {
    // Clicking a node already on the path takes the path back to it.
    return {
      ...state,
      draft: { nodes: draft.slice(0, position + 1) },
      message: `Back to ${nameOf(state, node)}.`,
    };
  }
  const last = draft[draft.length - 1] ?? flow.source;
  let current = state;
  if (!state.index.neighbours.get(last)?.some((step) => step.node === node)) {
    // A cable that is not built yet is built by drawing over it, if the budget allows
    current = buildOnTheWay(state, last, node);
    if (current === state) {
      return say(state, `${nameOf(state, node)} is not next to ${nameOf(state, last)}.`);
    }
    if (!current.built.includes(unbuiltBetween(state, last, node)?.id ?? '')) {
      return current;
    }
  }
  const next = [...draft, node];
  if (node === flow.target) {
    return saying(current, state, replaceEditedPath(current, flow, next));
  }
  return {
    ...current,
    draft: { nodes: next },
    message: `${current === state ? '' : `${current.message} `}${nameOf(current, node)} added.`,
  };
}

function wrongDrawing(state: PlayState, flow: Flow): string {
  return `Draw from ${nameOf(state, flow.source)} to ${nameOf(state, flow.target)} along the cables.`;
}

/** A path drawn in one go (a drag over the nodes). */
export function drawPath(state: PlayState, nodes: NodePath): PlayState {
  const flow = flowOf(state, state.selected);
  if (flow === undefined) {
    return say(state, 'Select a flow first.');
  }
  // Cables on the way that are not built yet are built, as long as the budget is enough
  let current = state;
  for (let step = 1; step < nodes.length; step += 1) {
    const from = nodes[step - 1] ?? '';
    const to = nodes[step] ?? '';
    if (!current.index.neighbours.get(from)?.some((entry) => entry.node === to)) {
      const wanted = unbuiltBetween(current, from, to);
      const built = buildOnTheWay(current, from, to);
      if (wanted === undefined || !built.built.includes(wanted.id)) {
        return built === current ? say(state, wrongDrawing(state, flow)) : built;
      }
      current = built;
    }
  }
  if (
    linksOfPath(current.index, nodes) === undefined ||
    nodes[0] !== flow.source ||
    nodes[nodes.length - 1] !== flow.target
  ) {
    return say(state, wrongDrawing(state, flow));
  }
  return saying(current, state, replaceEditedPath(current, flow, nodes));
}

/** The result of a move, with the building that came before it (if there was one) in its message. */
function saying(current: PlayState, before: PlayState, done: PlayState): PlayState {
  return current.built === before.built
    ? done
    : { ...done, message: `${current.message} ${done.message}` };
}

export function cancelDraft(state: PlayState): PlayState {
  return state.draft === undefined
    ? state
    : { ...state, draft: undefined, message: 'Drawing cancelled.' };
}

/** The fastest path for the edited lane (no helper: the player could draw it). */
export function suggestPath(state: PlayState): PlayState {
  const flow = flowOf(state, state.selected);
  if (flow === undefined) {
    return say(state, 'Select a flow first.');
  }
  const path = fastestRoute(state.index, flow);
  return path === undefined
    ? say(state, 'There is no way through.')
    : replaceEditedPath(state, flow, path);
}

function evenShares(count: number): number[] {
  return count === 1 ? [1] : count === 2 ? [0.5, 0.5] : [0.5, 0.25, 0.25];
}

/** Splits the edited stage over one more path (a copy of the first one, to be redrawn). */
export function addLane(state: PlayState): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  const stage = flowPlan?.stages[state.stage];
  if (flow === undefined || flowPlan === undefined || stage === undefined) {
    return say(state, 'Draw a path first.');
  }
  if (!state.index.level.rules.split) {
    return say(state, 'This level does not split flows yet.');
  }
  if (stage.paths.length >= MOST_LANES) {
    return say(state, `A flow can use at most ${String(MOST_LANES)} paths.`);
  }
  // The new path starts as a copy of the first one: the player draws its own route on the map
  const fresh = stage.paths[0]?.nodes ?? [];
  const count = stage.paths.length + 1;
  const shares = evenShares(count);
  const paths = [...stage.paths.map((entry) => entry.nodes), fresh].map((nodes, at) => ({
    nodes,
    share: shares[at] ?? 0.25,
  }));
  const stages = flowPlan.stages.map((entry, at) =>
    at === state.stage ? { ...entry, paths } : entry,
  );
  return {
    ...withFlowPlan(
      state,
      flow.id,
      { ...flowPlan, stages },
      `${flow.name} now has ${String(count)} paths. Path ${String(count)} is a copy of path 1 for now: click the nodes of its own route on the map.`,
    ),
    lane: count - 1,
    target: 'path',
  };
}

/** Takes a path out of a split; its share goes to the first other path. */
export function removeLane(state: PlayState): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  const stage = flowPlan?.stages[state.stage];
  if (
    flow === undefined ||
    flowPlan === undefined ||
    stage === undefined ||
    stage.paths.length < 2
  ) {
    return state;
  }
  const gone = stage.paths[state.lane];
  const rest = stage.paths.filter((_, at) => at !== state.lane);
  const paths = rest.map((entry, at) =>
    at === 0 ? { ...entry, share: entry.share + (gone?.share ?? 0) } : entry,
  );
  const stages = flowPlan.stages.map((entry, at) =>
    at === state.stage ? { ...entry, paths } : entry,
  );
  return {
    ...withFlowPlan(
      state,
      flow.id,
      { ...flowPlan, stages },
      `${flow.name} uses ${String(paths.length)} path${paths.length === 1 ? '' : 's'}.`,
    ),
    lane: 0,
  };
}

/** Moves a quarter of the flow from one path of the split to another. */
/** The path of the edited stage that can give a quarter to another one: the biggest with more than a quarter. */
export function donorOf(state: PlayState, to: number): number | undefined {
  const flow = flowOf(state, state.selected);
  const stage = flow === undefined ? undefined : state.plan[flow.id]?.stages[state.stage];
  let best: number | undefined;
  for (const [at, entry] of (stage?.paths ?? []).entries()) {
    if (
      at !== to &&
      entry.share > 0.25 &&
      (best === undefined || entry.share > (stage?.paths[best]?.share ?? 0))
    ) {
      best = at;
    }
  }
  return best;
}

export function moveShare(state: PlayState, from: number, to: number): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  const stage = flowPlan?.stages[state.stage];
  const source = stage?.paths[from];
  const target = stage?.paths[to];
  if (
    flow === undefined ||
    flowPlan === undefined ||
    stage === undefined ||
    source === undefined ||
    target === undefined
  ) {
    return state;
  }
  if (from === to || source.share <= 0.25) {
    return say(state, 'Every path of a split keeps at least a quarter.');
  }
  const paths = stage.paths.map((entry, at) =>
    at === from
      ? { ...entry, share: entry.share - 0.25 }
      : at === to
        ? { ...entry, share: entry.share + 0.25 }
        : entry,
  );
  const stages = flowPlan.stages.map((entry, at) =>
    at === state.stage ? { ...entry, paths } : entry,
  );
  return withFlowPlan(
    state,
    flow.id,
    { ...flowPlan, stages },
    `${flow.name}: ${paths.map((entry) => `${String(entry.share * 100)} %`).join(', ')}.`,
  );
}

/** Gives the flow a backup: the path that shares the fewest cables with the one in use. */
export function addBackup(state: PlayState): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  if (flow === undefined || flowPlan === undefined) {
    return say(state, 'Draw a path first.');
  }
  if (!state.index.level.rules.backup) {
    return say(state, 'This level has no backup paths yet.');
  }
  // The backup starts as a copy of the main path: the player draws its own route on the map
  const copy = flowPlan.stages[0]?.paths[0]?.nodes ?? [];
  return {
    ...withFlowPlan(
      state,
      flow.id,
      { ...flowPlan, backup: copy },
      `Backup for ${flow.name}: it is a copy of the path for now. Click the nodes of the backup route on the map.`,
    ),
    target: 'backup',
  };
}

export function removeBackup(state: PlayState): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  if (flow === undefined || flowPlan?.backup === undefined) {
    return state;
  }
  const rest: FlowPlan = {
    stages: flowPlan.stages,
    redundancy: flowPlan.redundancy,
    throttle: flowPlan.throttle,
  };
  return {
    ...withFlowPlan(state, flow.id, rest, `Backup for ${flow.name} removed.`),
    target: 'path',
  };
}

export function setRedundancy(state: PlayState, redundancy: Redundancy): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  if (flow === undefined || flowPlan === undefined) {
    return say(state, 'Draw a path first.');
  }
  if (!state.index.level.rules.redundancy) {
    return say(state, 'This level has no redundancy yet.');
  }
  return withFlowPlan(
    state,
    flow.id,
    { ...flowPlan, redundancy },
    `${flow.name}: ${String(redundancy * 100)} % extra packets.`,
  );
}

export function setThrottle(state: PlayState, throttle: number): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  if (flow === undefined || flowPlan === undefined) {
    return say(state, 'Draw a path first.');
  }
  if (!state.index.level.rules.throttle || !profiles[flow.profile].throttlable) {
    return say(state, `${profiles[flow.profile].name} traffic cannot be held back.`);
  }
  return withFlowPlan(
    state,
    flow.id,
    { ...flowPlan, throttle },
    `${flow.name} sends ${String(Math.round(throttle * 100))} % of its traffic.`,
  );
}

/** From a step on, the flow takes other paths (a link that moves). The new stage starts as a copy. */
export function addStage(state: PlayState, from: number): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  if (flow === undefined || flowPlan === undefined) {
    return say(state, 'Draw a path first.');
  }
  if (!state.index.level.rules.stages) {
    return say(state, 'This level has no planned changes of path yet.');
  }
  if (flowPlan.stages.some((stage) => stage.from === from) || from <= 0) {
    return say(state, `There is already a change in minute ${String(from + 1)}.`);
  }
  const before =
    [...flowPlan.stages].filter((stage) => stage.from < from).pop() ?? flowPlan.stages[0];
  const stages: RouteStage[] = [...flowPlan.stages, { from, paths: before?.paths ?? [] }].sort(
    (a, b) => a.from - b.from,
  );
  const at = stages.findIndex((stage) => stage.from === from);
  return {
    ...withFlowPlan(
      state,
      flow.id,
      { ...flowPlan, stages },
      `${flow.name} changes its path in minute ${String(from + 1)}. Draw its new route on the map.`,
    ),
    stage: at,
    lane: 0,
    target: 'path',
  };
}

export function removeStage(state: PlayState): PlayState {
  const flow = flowOf(state, state.selected);
  const flowPlan = flow === undefined ? undefined : state.plan[flow.id];
  if (
    flow === undefined ||
    flowPlan === undefined ||
    state.stage === 0 ||
    flowPlan.stages.length < 2
  ) {
    return state;
  }
  const stages = flowPlan.stages.filter((_, at) => at !== state.stage);
  return {
    ...withFlowPlan(
      state,
      flow.id,
      { ...flowPlan, stages },
      `${flow.name} no longer changes its path.`,
    ),
    stage: 0,
    lane: 0,
  };
}

/** The steps where a change of path can be planned: where something starts or stops. */
export function stageChoices(state: PlayState): number[] {
  return switchSteps(state.index);
}

export function undo(state: PlayState): PlayState {
  const previous = state.past[state.past.length - 1];
  if (previous === undefined) {
    return state;
  }
  return {
    ...restore(state, previous),
    past: state.past.slice(0, -1),
    future: [{ plan: state.plan, built: state.built }, ...state.future],
    message: 'Undone.',
  };
}

export function redo(state: PlayState): PlayState {
  const next = state.future[0];
  if (next === undefined) {
    return state;
  }
  return {
    ...restore(state, next),
    past: [...state.past, { plan: state.plan, built: state.built }],
    future: state.future.slice(1),
    message: 'Redone.',
  };
}

/** Clears the plan and takes back the cables that were built: the level as it was at the start. */
export function resetPlan(state: PlayState): PlayState {
  if (Object.keys(state.plan).length === 0 && state.built.length === 0) {
    return state;
  }
  return {
    ...commit(
      state,
      {},
      state.built.length > 0
        ? 'The plan is empty again and the cables you built are gone.'
        : 'The plan is empty again.',
      [],
    ),
    assisted: false,
  };
}

/** A helper fills in the whole plan. The run is marked as assisted and earns no stars. */
export function applyStrategy(state: PlayState, which: 'shortest' | 'balanced'): PlayState {
  // The helpers build in their own simple way, too
  const built = optionalLinks(state.base).length > 0 ? simpleBuild(state.base) : state.built;
  const index = indexLevel(withBuilt(state.base, built));
  const plan = which === 'shortest' ? shortestPathPlan(index) : loadBalancedPlan(index);
  return {
    ...commit(
      state,
      plan,
      which === 'shortest'
        ? 'Everybody takes the shortest path. This run earns no stars.'
        : 'The load is balanced for you. This run earns no stars.',
      built,
    ),
    assisted: true,
    stage: 0,
    lane: 0,
    target: 'path',
  };
}

/** Whether every flow has a path and the plan can run. */
export function readyToRun(state: PlayState): boolean {
  return (
    state.index.level.flows.every((flow) => state.plan[flow.id] !== undefined) &&
    problemsOfPlan(state.index, state.plan).length === 0
  );
}

/** The flows that still need a path. */
export function unrouted(state: PlayState): Flow[] {
  return state.index.level.flows.filter((flow) => state.plan[flow.id] === undefined);
}

/** Takes the last node off the path that is being drawn. */
export function stepBack(state: PlayState): PlayState {
  const draft = state.draft?.nodes;
  if (draft === undefined) {
    return state;
  }
  return draft.length <= 1
    ? { ...state, draft: undefined, message: 'Drawing cancelled.' }
    : { ...state, draft: { nodes: draft.slice(0, -1) }, message: 'Last node taken back.' };
}

/** Builds a cable, or takes it away again. Taking one away removes the paths that used it. */
export function toggleBuild(state: PlayState, linkId: string): PlayState {
  const link = optionalLinks(state.base).find((entry) => entry.id === linkId);
  if (link === undefined) {
    return state;
  }
  const names = new Map(state.base.nodes.map((node) => [node.id, node.name]));
  const name = `${names.get(link.a) ?? link.a} – ${names.get(link.b) ?? link.b}`;
  if (state.built.includes(linkId)) {
    const built = state.built.filter((id) => id !== linkId);
    const next = indexLevel(withBuilt(state.base, built));
    // A flow whose paths no longer exist has to be routed again
    const plan = Object.fromEntries(
      Object.entries(state.plan).filter(
        ([id, flowPlan]) => problemsOfPlan(next, { [id]: flowPlan }).length === 0,
      ),
    );
    const lost = Object.keys(state.plan).length - Object.keys(plan).length;
    return commit(
      state,
      plan,
      `${name} is not built any more.${lost > 0 ? ` ${String(lost)} flow${lost === 1 ? '' : 's'} lost the path over it.` : ''}`,
      built,
    );
  }
  const left = (state.base.budget ?? 0) - spent(state.base, state.built);
  if (costOf(link) > left) {
    return say(
      state,
      `${name} costs ${String(costOf(link))}, and only ${String(left)} is left of the budget.`,
    );
  }
  return commit(state, state.plan, `${name} is built for ${String(costOf(link))}.`, [
    ...state.built,
    linkId,
  ]);
}

/** Loads a whole design (cables and plan), as the best plan of a solved level does. */
export function loadDesign(state: PlayState, plan: Plan, built: readonly string[]): PlayState {
  return {
    ...commit(state, plan, 'The best plan is loaded. This run earns no stars.', built),
    assisted: true,
    stage: 0,
    lane: 0,
    target: 'path',
  };
}

/** What is left of the budget. */
export function budgetLeft(state: PlayState): number {
  return (state.base.budget ?? 0) - spent(state.base, state.built);
}

/** Takes the whole plan of the selected flow away (path, split, backup and options). */
export function removeFlowPlan(state: PlayState): PlayState {
  const flow = flowOf(state, state.selected);
  if (flow === undefined || state.plan[flow.id] === undefined) {
    return state;
  }
  const rest = Object.fromEntries(Object.entries(state.plan).filter(([id]) => id !== flow.id));
  return {
    ...commit(state, rest, `${flow.name} has no route any more.`),
    stage: 0,
    lane: 0,
    target: 'path',
  };
}

/** The number of a flow in the list of the level (from 1): its short name on the map. */
export function flowNumber(level: Level, flowId: string): number {
  return level.flows.findIndex((flow) => flow.id === flowId) + 1;
}
