import { describe, expect, it } from 'vitest';

import { diamond } from './fixtures';
import { problemsOfPlan } from './plan';
import {
  addBackup,
  addLane,
  addStage,
  applyStrategy,
  cancelDraft,
  clickNode,
  donorOf,
  drawPath,
  editedPath,
  flowNumber,
  moveShare,
  type PlayState,
  readyToRun,
  redo,
  removeBackup,
  removeFlowPlan,
  removeLane,
  removeStage,
  resetPlan,
  selectEdit,
  selectFlow,
  setRedundancy,
  setThrottle,
  stageChoices,
  startState,
  suggestPath,
  undo,
  unrouted,
} from './play';
import type { Flow } from './types';

const flows: Flow[] = [
  { id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 8 },
  { id: 'f2', name: 'Backup', source: 'A', target: 'D', profile: 'bulk', demand: 6 },
];

function start(): PlayState {
  return startState(
    diamond({
      flows,
      situations: [
        { id: 'calm', name: 'Calm', steps: 6, events: [] },
        {
          id: 'cut',
          name: 'Cut',
          steps: 8,
          events: [{ kind: 'down', link: 'BD', from: 3, to: 6 }],
        },
      ],
    }),
  );
}

/** The first flow again: after its first route the game has moved on to the next flow. */
const first = (state: PlayState): PlayState => selectFlow(state, 'f1');

function drawn(state: PlayState, nodes: string[]): PlayState {
  return nodes.reduce((current, node) => clickNode(current, node), state);
}

describe('drawing a path', () => {
  it('starts at the source and ends at the target', () => {
    let state = start();
    state = clickNode(state, 'B');
    expect(state.draft).toBeUndefined();
    expect(state.message).toContain('Start at A');
    state = drawn(state, ['A', 'B']);
    expect(state.draft?.nodes).toEqual(['A', 'B']);
    state = clickNode(state, 'D');
    expect(state.draft).toBeUndefined();
    expect(editedPath(first(state))).toEqual(['A', 'B', 'D']);
    expect(problemsOfPlan(state.index, state.plan)).toEqual([]);
  });

  it('goes on with the next flow without a route after the first route of a flow', () => {
    const state = drawn(start(), ['A', 'B', 'D']);
    expect(state.selected).toBe('f2');
    expect(state.message).toContain('Backup selected');
    // The last flow has no flow after it that lacks a route: the selection stays where it is
    const done = drawPath(state, ['A', 'C', 'D']);
    expect(done.selected).toBe('f2');
    // A route that is redrawn does not move the selection
    expect(drawPath(selectFlow(done, 'f1'), ['A', 'C', 'D']).selected).toBe('f1');
    // Neither does the fastest route when the flow had one before
    expect(suggestPath(selectFlow(done, 'f1')).selected).toBe('f1');
    // The list is a circle: the first flow is next after the last
    const last = drawPath(selectFlow(start(), 'f2'), ['A', 'C', 'D']);
    expect(last.selected).toBe('f1');
  });

  it('refuses a node that is not next to the last one', () => {
    const state = drawn(start(), ['A', 'D']);
    expect(state.message).toContain('not next to');
    expect(state.draft?.nodes).toEqual(['A']);
  });

  it('goes back when a node of the path is clicked again, and can be cancelled', () => {
    let state = drawn(start(), ['A', 'B']);
    state = clickNode(state, 'A');
    expect(state.draft?.nodes).toEqual(['A']);
    expect(cancelDraft(state).draft).toBeUndefined();
  });

  it('replaces the old path only when the new one is finished', () => {
    let state = first(drawn(start(), ['A', 'B', 'D']));
    state = drawn(state, ['A', 'C']);
    expect(editedPath(state)).toEqual(['A', 'B', 'D']);
    state = clickNode(state, 'D');
    expect(editedPath(state)).toEqual(['A', 'C', 'D']);
  });

  it('accepts a path drawn in one go and refuses a wrong one', () => {
    const good = drawPath(start(), ['A', 'C', 'D']);
    expect(editedPath(first(good))).toEqual(['A', 'C', 'D']);
    const bad = drawPath(start(), ['A', 'D']);
    expect(bad.plan).toEqual({});
  });

  it('suggests the shortest path', () => {
    expect(editedPath(first(suggestPath(start())))).toEqual(['A', 'B', 'D']);
  });
});

describe('undo and the helpers', () => {
  it('undoes and redoes', () => {
    const one = first(drawPath(start(), ['A', 'B', 'D']));
    const second = drawPath(one, ['A', 'C', 'D']);
    const back = undo(second);
    expect(editedPath(back)).toEqual(['A', 'B', 'D']);
    expect(editedPath(redo(back))).toEqual(['A', 'C', 'D']);
    expect(undo(start())).toEqual(start());
  });

  it('marks a run as assisted when a helper fills in the plan, and a reset clears that', () => {
    const state = applyStrategy(start(), 'balanced');
    expect(state.assisted).toBe(true);
    expect(readyToRun(state)).toBe(true);
    const cleared = resetPlan(state);
    expect(cleared.assisted).toBe(false);
    expect(cleared.plan).toEqual({});
  });

  it('is ready only when every flow has a path', () => {
    const state = drawPath(start(), ['A', 'B', 'D']);
    expect(readyToRun(state)).toBe(false);
    expect(unrouted(state).map((flow) => flow.id)).toEqual(['f2']);
    expect(readyToRun(drawPath(selectFlow(state, 'f2'), ['A', 'C', 'D']))).toBe(true);
  });
});

describe('the options of a flow', () => {
  const routed = (): PlayState => first(drawPath(start(), ['A', 'B', 'D']));

  it('splits a flow in quarters and keeps the plan valid', () => {
    let state = addLane(routed());
    expect(state.plan.f1?.stages[0]?.paths.map((entry) => entry.share)).toEqual([0.5, 0.5]);
    // The new path is a copy of the first one, selected, until the player draws its own route
    expect(editedPath(state)).toEqual(['A', 'B', 'D']);
    expect(state.lane).toBe(1);
    expect(state.message).toContain('click the nodes');
    state = drawPath(state, ['A', 'C', 'D']);
    expect(state.plan.f1?.stages[0]?.paths.map((entry) => entry.nodes.join())).toEqual([
      'A,B,D',
      'A,C,D',
    ]);
    state = moveShare(state, 1, 0);
    expect(state.plan.f1?.stages[0]?.paths.map((entry) => entry.share)).toEqual([0.75, 0.25]);
    state = addLane(state);
    expect(state.plan.f1?.stages[0]?.paths).toHaveLength(3);
    expect(problemsOfPlan(state.index, state.plan)).toEqual([]);
    expect(addLane(state).message).toContain('at most');
    state = removeLane(selectEdit(state, 0, 2, 'path'));
    expect(state.plan.f1?.stages[0]?.paths).toHaveLength(2);
    expect(problemsOfPlan(state.index, state.plan)).toEqual([]);
  });

  it('says which path can give a quarter to another one', () => {
    let state = addLane(routed());
    expect(donorOf(state, 1)).toBe(0);
    expect(donorOf(state, 0)).toBe(1);
    state = moveShare(state, 0, 1);
    // 25 against 75: the path with a quarter cannot give
    expect(donorOf(state, 0)).toBe(1);
    expect(donorOf(state, 1)).toBeUndefined();
  });

  it('keeps at least a quarter on every path', () => {
    const state = moveShare(addLane(routed()), 0, 1);
    const again = moveShare(state, 0, 1);
    expect(again.plan.f1?.stages[0]?.paths.map((entry) => entry.share)).toEqual([0.25, 0.75]);
    expect(moveShare(again, 0, 1).message).toContain('at least a quarter');
  });

  it('adds a backup that the player draws, and removes it', () => {
    let state = addBackup(routed());
    // It starts as a copy of the path, and it is the one that is edited
    expect(state.plan.f1?.backup).toEqual(['A', 'B', 'D']);
    expect(state.target).toBe('backup');
    state = drawPath(state, ['A', 'C', 'D']);
    expect(state.plan.f1?.backup).toEqual(['A', 'C', 'D']);
    expect(problemsOfPlan(state.index, state.plan)).toEqual([]);
    state = removeBackup(state);
    expect(state.plan.f1?.backup).toBeUndefined();
  });

  it('sets redundancy, and throttle only for traffic that can be held back', () => {
    let state = setRedundancy(routed(), 0.25);
    expect(state.plan.f1?.redundancy).toBe(0.25);
    state = setThrottle(state, 0.5);
    expect(state.plan.f1?.throttle).toBe(1);
    expect(state.message).toContain('cannot be held back');
    state = drawPath(selectFlow(state, 'f2'), ['A', 'C', 'D']);
    state = setThrottle(state, 0.5);
    expect(state.plan.f2?.throttle).toBe(0.5);
    expect(problemsOfPlan(state.index, state.plan)).toEqual([]);
  });

  it('plans a change of path at a step, and takes it away again', () => {
    expect(stageChoices(routed())).toEqual([3, 6]);
    let state = addStage(routed(), 3);
    expect(state.plan.f1?.stages.map((stage) => stage.from)).toEqual([0, 3]);
    expect(state.stage).toBe(1);
    state = drawPath(state, ['A', 'C', 'D']);
    expect(problemsOfPlan(state.index, state.plan)).toEqual([]);
    expect(addStage(state, 3).message).toContain('already');
    state = removeStage(state);
    expect(state.plan.f1?.stages).toHaveLength(1);
  });

  it('refuses options the level does not have', () => {
    const plain = startState(
      diamond({
        flows,
        rules: {
          split: false,
          backup: false,
          redundancy: false,
          throttle: false,
          stages: false,
          queues: false,
        },
      }),
    );
    const state = first(drawPath(plain, ['A', 'B', 'D']));
    for (const next of [
      addLane(state),
      addBackup(state),
      setRedundancy(state, 0.25),
      addStage(state, 3),
    ]) {
      expect(next.plan).toEqual(state.plan);
      expect(next.message).toMatch(/does not|has no/);
    }
  });

  it('can undo an option', () => {
    const split = addLane(first(drawPath(start(), ['A', 'B', 'D'])));
    expect(undo(split).plan.f1?.stages[0]?.paths).toHaveLength(1);
  });
});

describe('taking a route away', () => {
  it('removes the plan of the selected flow only, and can be undone', () => {
    let state = first(drawPath(start(), ['A', 'B', 'D']));
    state = drawPath(selectFlow(state, 'f2'), ['A', 'C', 'D']);
    const removed = removeFlowPlan(state);
    expect(Object.keys(removed.plan)).toEqual(['f1']);
    expect(removed.message).toContain('has no route any more');
    expect(Object.keys(undo(removed).plan).sort()).toEqual(['f1', 'f2']);
    expect(removeFlowPlan(removed)).toBe(removed);
  });

  it('numbers the flows from one', () => {
    const level = start().index.level;
    expect(flowNumber(level, 'f1')).toBe(1);
    expect(flowNumber(level, 'f2')).toBe(2);
  });
});

describe('drawing over a cable that is not built yet', () => {
  const withGhost = (budget: number): PlayState =>
    startState(
      diamond({
        flows: flows.slice(0, 1),
        links: [
          { id: 'AB', a: 'A', b: 'B', capacity: 10, delay: 1, loss: 0 },
          { id: 'BD', a: 'B', b: 'D', capacity: 10, delay: 1, loss: 0 },
          { id: 'AC', a: 'A', b: 'C', capacity: 10, delay: 2, loss: 0 },
          { id: 'CD', a: 'C', b: 'D', capacity: 10, delay: 2, loss: 0 },
          { id: 'AD', a: 'A', b: 'D', capacity: 10, delay: 1, loss: 0, optional: true, cost: 4 },
        ],
        budget,
      }),
    );

  it('builds the cable by clicking over it, when the budget is enough', () => {
    let state = withGhost(5);
    expect(state.built).toEqual([]);
    state = drawn(state, ['A', 'D']);
    expect(state.built).toEqual(['AD']);
    expect(editedPath(state)).toEqual(['A', 'D']);
    expect(state.message).toContain('is built for 4');
    // Undo takes the route first and then the cable
    expect(undo(state).built).toEqual(['AD']);
    expect(undo(undo(state)).built).toEqual([]);
  });

  it('builds the cables of a path that is drawn in one go', () => {
    const state = drawPath(withGhost(5), ['A', 'D']);
    expect(state.built).toEqual(['AD']);
    expect(editedPath(state)).toEqual(['A', 'D']);
  });

  it('says so and builds nothing when the budget is not enough', () => {
    const clicked = drawn(withGhost(3), ['A', 'D']);
    expect(clicked.built).toEqual([]);
    expect(clicked.message).toContain('only 3 is left');
    expect(clicked.draft?.nodes).toEqual(['A']);
    const dragged = drawPath(withGhost(3), ['A', 'D']);
    expect(dragged.built).toEqual([]);
    expect(dragged.plan).toEqual({});
  });
});

describe('a flow that has to pass a node', () => {
  const guarded = (): PlayState =>
    startState(
      diamond({
        flows: [
          {
            id: 'f1',
            name: 'Guests',
            source: 'A',
            target: 'D',
            profile: 'web',
            demand: 4,
            via: ['C'],
          },
        ],
      }),
    );

  it('does not accept a route that skips the node, and takes the drawing back', () => {
    let state = guarded();
    for (const node of ['A', 'B', 'D']) {
      state = clickNode(state, node);
    }
    expect(state.plan).toEqual({});
    expect(state.draft).toBeUndefined();
    expect(state.message).toContain('has to pass C');
    expect(unrouted(state)).toHaveLength(1);
    const dragged = drawPath(guarded(), ['A', 'B', 'D']);
    expect(dragged.plan).toEqual({});
    expect(readyToRun(dragged)).toBe(false);
  });

  it('accepts a route over the node, and keeps the old route when a new one skips it', () => {
    let state = drawPath(guarded(), ['A', 'C', 'D']);
    expect(Object.keys(state.plan)).toEqual(['f1']);
    state = drawPath(state, ['A', 'B', 'D']);
    expect(editedPath(state)).toEqual(['A', 'C', 'D']);
  });
});
