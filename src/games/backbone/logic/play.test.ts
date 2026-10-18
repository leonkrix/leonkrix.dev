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
  drawPath,
  editedPath,
  moveShare,
  type PlayState,
  readyToRun,
  redo,
  removeBackup,
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
    expect(editedPath(state)).toEqual(['A', 'B', 'D']);
    expect(problemsOfPlan(state.index, state.plan)).toEqual([]);
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
    let state = drawn(start(), ['A', 'B', 'D']);
    state = drawn(state, ['A', 'C']);
    expect(editedPath(state)).toEqual(['A', 'B', 'D']);
    state = clickNode(state, 'D');
    expect(editedPath(state)).toEqual(['A', 'C', 'D']);
  });

  it('accepts a path drawn in one go and refuses a wrong one', () => {
    const good = drawPath(start(), ['A', 'C', 'D']);
    expect(editedPath(good)).toEqual(['A', 'C', 'D']);
    const bad = drawPath(start(), ['A', 'D']);
    expect(bad.plan).toEqual({});
  });

  it('suggests the shortest path', () => {
    expect(editedPath(suggestPath(start()))).toEqual(['A', 'B', 'D']);
  });
});

describe('undo and the helpers', () => {
  it('undoes and redoes', () => {
    const first = drawPath(start(), ['A', 'B', 'D']);
    const second = drawPath(first, ['A', 'C', 'D']);
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
  const routed = (): PlayState => drawPath(start(), ['A', 'B', 'D']);

  it('splits a flow in quarters and keeps the plan valid', () => {
    let state = addLane(routed());
    expect(state.plan.f1?.stages[0]?.paths.map((entry) => entry.share)).toEqual([0.5, 0.5]);
    expect(editedPath(state)).not.toEqual(['A', 'B', 'D']);
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

  it('keeps at least a quarter on every path', () => {
    const state = moveShare(addLane(routed()), 0, 1);
    const again = moveShare(state, 0, 1);
    expect(again.plan.f1?.stages[0]?.paths.map((entry) => entry.share)).toEqual([0.25, 0.75]);
    expect(moveShare(again, 0, 1).message).toContain('at least a quarter');
  });

  it('adds a backup that avoids the cables in use, and removes it', () => {
    let state = addBackup(routed());
    expect(state.plan.f1?.backup).toEqual(['A', 'C', 'D']);
    expect(state.target).toBe('backup');
    state = drawPath(selectEdit(state, 0, 0, 'backup'), ['A', 'C', 'D']);
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
        rules: { split: false, backup: false, redundancy: false, throttle: false, stages: false },
      }),
    );
    const state = drawPath(plain, ['A', 'B', 'D']);
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
    const split = addLane(drawPath(start(), ['A', 'B', 'D']));
    expect(undo(split).plan.f1?.stages[0]?.paths).toHaveLength(1);
  });
});
