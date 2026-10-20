import { describe, expect, it } from 'vitest';

import { diamond } from './fixtures';
import { hintFor } from './hint';
import { singlePath } from './plan';
import { clickNode, drawPath, selectFlow, startState } from './play';
import { solve } from './solver';
import type { Flow } from './types';

const flows: Flow[] = [
  { id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 8 },
  { id: 'f2', name: 'Video', source: 'A', target: 'D', profile: 'video', demand: 8 },
];

function setup() {
  const level = diamond({ flows });
  const best = solve(level);
  return { level, guide: { plan: best.plan, built: [], score: best.score } };
}

describe('hints', () => {
  it('ask for a path first while a flow has none', () => {
    const { level, guide } = setup();
    const hint = hintFor(startState(level), guide, 1);
    expect(hint.text).toContain('Give every flow a path first');
    expect(hint.flows).toEqual(['f1', 'f2']);
    expect(hint.givesAway).toBe(false);
  });

  it('name the overfull cable, then who uses it, then what to do', () => {
    const { level, guide } = setup();
    let state = drawPath(startState(level), ['A', 'B', 'D']);
    state = drawPath(selectFlow(state, 'f2'), ['A', 'B', 'D']);
    const first = hintFor(state, guide, 1);
    expect(first.text).toContain('of its capacity');
    expect(first.links.length).toBe(1);
    expect(first.givesAway).toBe(false);
    const second = hintFor(state, guide, 2);
    expect(second.text).toContain('Web and Video');
    expect(second.flows).toEqual(['f1', 'f2']);
    const third = hintFor(state, guide, 3);
    expect(third.givesAway).toBe(true);
    expect(third.text).toMatch(/Try sending|Split/);
  });

  it('say so when the plan is about as good as the best one', () => {
    const { level, guide } = setup();
    let state = startState(level);
    for (const flow of flows) {
      state = selectFlow(state, flow.id);
      const planned = guide.plan[flow.id]?.stages[0]?.paths[0]?.nodes ?? [];
      for (const node of planned) {
        state = clickNode(state, node);
      }
    }
    state = { ...state, plan: guide.plan };
    expect(hintFor(state, guide, 1).text).toContain('about as good as it gets');
  });

  it('keep the same words when a path is whole but not the best', () => {
    const { level, guide } = setup();
    let state = drawPath(startState(level), ['A', 'C', 'D']);
    state = { ...state, plan: { ...state.plan, f2: singlePath(['A', 'C', 'D']) } };
    const hint = hintFor(state, guide, 3);
    expect(hint.text.length).toBeGreaterThan(10);
  });
});
