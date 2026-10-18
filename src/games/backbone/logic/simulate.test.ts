import { describe, expect, it } from 'vitest';

import { diamond, randomLevel, randomPlan } from './fixtures';
import { problemsOfPlan, singlePath } from './plan';
import { evaluate, REPAIR_DELAY } from './simulate';
import type { Flow, FlowPlan, Plan } from './types';

const fast = ['A', 'B', 'D'];
const slow = ['A', 'C', 'D'];

function flow(id: string, profile: Flow['profile'], demand: number): Flow {
  return { id, name: id, source: 'A', target: 'D', profile, demand };
}

function valueOf(evaluation: ReturnType<typeof evaluate>, id: string, situation = 0): number {
  return (evaluation.situations[situation]?.steps ?? []).reduce(
    (sum, step) => sum + (step.flows[id]?.value ?? 0),
    0,
  );
}

describe('the stress test', () => {
  it('gives full marks to a flow that fits', () => {
    const result = evaluate(diamond(), { f1: singlePath(fast) });
    expect(result.score).toBeCloseTo(1, 9);
  });

  it('gives nothing for a flow that is left out', () => {
    expect(evaluate(diamond(), {}).score).toBe(0);
  });

  it('drops what does not fit and shares the loss within a queue', () => {
    const level = diamond({ flows: [flow('f1', 'web', 8), flow('f2', 'web', 8)] });
    const result = evaluate(level, { f1: singlePath(fast), f2: singlePath(fast) });
    const delivered = result.situations[0]?.steps[0]?.flows.f1?.delivered ?? 0;
    expect(delivered).toBeCloseTo(10 / 16, 9);
    expect(result.situations[0]?.steps[0]?.links.AB?.offered).toBe(16);
  });

  it('is fixed by splitting the traffic over both ways', () => {
    const level = diamond({ flows: [flow('f1', 'web', 16)] });
    const alone = evaluate(level, { f1: singlePath(fast) }).score;
    const split: FlowPlan = {
      stages: [
        {
          from: 0,
          paths: [
            { nodes: fast, share: 0.5 },
            { nodes: slow, share: 0.5 },
          ],
        },
      ],
      redundancy: 0,
      throttle: 1,
    };
    const both = evaluate(level, { f1: split }).score;
    expect(both).toBeGreaterThan(alone);
    expect(both).toBeGreaterThan(0.95);
  });

  it('serves voice before bulk on the same link', () => {
    const level = diamond({ flows: [flow('voice', 'voice', 6), flow('bulk', 'bulk', 8)] });
    const result = evaluate(level, { voice: singlePath(fast), bulk: singlePath(fast) });
    const step = result.situations[0]?.steps[0];
    expect(step?.flows.voice?.delivered).toBeCloseTo(1, 9);
    expect(step?.flows.bulk?.delivered).toBeCloseTo(0.5, 9);
  });

  it('lets throttled bulk traffic make room', () => {
    const level = diamond({ flows: [flow('web', 'web', 8), flow('bulk', 'bulk', 8)] });
    const plan: Plan = {
      web: singlePath(fast),
      bulk: { ...singlePath(fast), throttle: 0.25 },
    };
    const step = evaluate(level, plan).situations[0]?.steps[0];
    expect(step?.flows.web?.delivered).toBeCloseTo(1, 9);
    expect(step?.flows.bulk?.sent).toBe(2);
    expect(step?.flows.bulk?.delivered).toBeCloseTo(0.25, 9);
  });

  it('punishes a voice flow that takes the long way', () => {
    const level = diamond({ flows: [flow('f1', 'voice', 8)] });
    const onFast = valueOf(evaluate(level, { f1: singlePath(fast) }), 'f1');
    const onSlow = valueOf(evaluate(level, { f1: singlePath(slow) }), 'f1');
    expect(onFast).toBeCloseTo(3 * 8 * 6, 6);
    expect(onSlow).toBeLessThan(onFast);
  });

  it('does not mind latency for bulk traffic', () => {
    const level = diamond({ flows: [flow('f1', 'bulk', 4)] });
    expect(evaluate(level, { f1: singlePath(slow) }).score).toBeCloseTo(1, 9);
  });

  describe('failures', () => {
    const cut = { kind: 'down', link: 'BD', from: 1, to: 6 } as const;
    const level = diamond({ situations: [{ id: 'cut', name: 'Cut', steps: 6, events: [cut] }] });

    it('loses the traffic until the network repairs the route, then reroutes it', () => {
      const steps = evaluate(level, { f1: singlePath(fast) }).situations[0]?.steps ?? [];
      const delivered = steps.map((step) => step.flows.f1?.delivered ?? 0);
      expect(delivered[0]).toBeCloseTo(1, 9);
      for (let step = 1; step <= REPAIR_DELAY; step += 1) {
        expect(delivered[step]).toBe(0);
      }
      expect(delivered[REPAIR_DELAY + 1]).toBeCloseTo(1, 9);
      expect(steps[REPAIR_DELAY + 1]?.links.AC?.offered).toBe(8);
    });

    it('switches to a backup path at once', () => {
      const plan: Plan = { f1: { ...singlePath(fast), backup: slow } };
      const steps = evaluate(level, plan).situations[0]?.steps ?? [];
      expect(steps.every((step) => (step.flows.f1?.delivered ?? 0) > 0.99)).toBe(true);
    });

    it('does not use a backup that is cut as well', () => {
      const both = diamond({
        situations: [
          {
            id: 'cut',
            name: 'Cut',
            steps: 4,
            events: [
              { kind: 'down', link: 'BD', from: 1, to: 4 },
              { kind: 'down', link: 'CD', from: 1, to: 4 },
            ],
          },
        ],
      });
      const plan: Plan = { f1: { ...singlePath(fast), backup: slow } };
      const steps = evaluate(both, plan).situations[0]?.steps ?? [];
      expect(steps[1]?.flows.f1?.delivered).toBe(0);
      expect(steps[3]?.flows.f1?.delivered).toBe(0);
    });

    it('can switch paths at a planned time (a link that moves away)', () => {
      const plan: Plan = {
        f1: {
          stages: [
            { from: 0, paths: [{ nodes: fast, share: 1 }] },
            { from: 1, paths: [{ nodes: slow, share: 1 }] },
          ],
          redundancy: 0,
          throttle: 1,
        },
      };
      const steps = evaluate(level, plan).situations[0]?.steps ?? [];
      expect(steps.every((step) => (step.flows.f1?.delivered ?? 0) > 0.99)).toBe(true);
    });
  });

  describe('loss and redundancy', () => {
    const lossy = diamond({
      flows: [flow('f1', 'transaction', 4)],
      links: diamond().links.map((link) => (link.id === 'AB' ? { ...link, loss: 0.2 } : link)),
    });

    it('loses what the link loses', () => {
      const step = evaluate(lossy, { f1: singlePath(fast) }).situations[0]?.steps[0];
      expect(step?.flows.f1?.delivered).toBeCloseTo(0.8, 9);
    });

    it('recovers a loss up to the redundancy, and the redundancy uses capacity', () => {
      const plan: Plan = { f1: { ...singlePath(fast), redundancy: 0.25 } };
      const step = evaluate(lossy, plan).situations[0]?.steps[0];
      expect(step?.flows.f1?.delivered).toBeCloseTo(1, 9);
      expect(step?.links.AB?.offered).toBeCloseTo(5, 9);
    });

    it('lets a transaction suffer more from loss than bulk traffic', () => {
      const bulk = { ...lossy, flows: [flow('f1', 'bulk', 4)] };
      const transaction = evaluate(lossy, { f1: singlePath(fast) }).score;
      expect(evaluate(bulk, { f1: singlePath(fast) }).score).toBeGreaterThan(transaction);
    });
  });

  it('counts the worst situation twice', () => {
    const level = diamond({
      situations: [
        { id: 'calm', name: 'Calm', steps: 4, events: [] },
        {
          id: 'cut',
          name: 'Cut',
          steps: 4,
          events: [{ kind: 'down', link: 'BD', from: 0, to: 4 }],
        },
      ],
    });
    const result = evaluate(level, { f1: singlePath(fast) });
    const [calm, cut] = result.situations.map((situation) => situation.score);
    expect(calm).toBeCloseTo(1, 9);
    expect(result.score).toBeCloseTo(((calm ?? 0) + 2 * (cut ?? 0)) / 3, 9);
  });

  it('is deterministic', () => {
    const level = randomLevel(5);
    const plan = randomPlan(level, 9);
    expect(evaluate(level, plan)).toEqual(evaluate(level, plan));
  });
});

describe('the property the solver relies on', () => {
  it('never lets extra traffic help a flow that is already in the plan', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const level = randomLevel(seed, 6 + (seed % 4), 4);
      const everything = level.flows.map((candidate) => candidate.id);
      const full = randomPlan(level, seed * 3, everything);
      const withoutLast: Plan = Object.fromEntries(Object.entries(full).slice(0, -1));
      const before = evaluate(level, withoutLast);
      const after = evaluate(level, full);
      for (const id of Object.keys(withoutLast)) {
        before.situations.forEach((situation, position) => {
          expect(
            valueOf(after, id, position),
            `seed ${String(seed)}, flow ${id}`,
          ).toBeLessThanOrEqual(valueOf(before, id, position) + 1e-9);
          expect(situation.steps.length).toBeGreaterThan(0);
        });
      }
    }
  });

  it('makes only runnable random plans', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const level = randomLevel(seed);
      expect(problemsOfPlan(level, randomPlan(level, seed))).toEqual([]);
    }
  });
});

describe('problems of a plan', () => {
  const level = diamond();

  it('accepts a good plan', () => {
    expect(problemsOfPlan(level, { f1: singlePath(fast) })).toEqual([]);
  });

  it('finds wrong endpoints, missing links and unknown flows', () => {
    expect(problemsOfPlan(level, { f1: singlePath(['A', 'B']) })).toHaveLength(1);
    expect(problemsOfPlan(level, { f1: singlePath(['A', 'D']) })).toHaveLength(1);
    expect(problemsOfPlan(level, { nope: singlePath(fast) })).toHaveLength(1);
  });

  it('finds shares that are not quarters or do not add up', () => {
    const plan: Plan = {
      f1: {
        stages: [
          {
            from: 0,
            paths: [
              { nodes: fast, share: 0.3 },
              { nodes: slow, share: 0.7 },
            ],
          },
        ],
        redundancy: 0,
        throttle: 1,
      },
    };
    expect(problemsOfPlan(level, plan).length).toBeGreaterThan(0);
  });

  it('allows throttling only for traffic that can be held back', () => {
    expect(problemsOfPlan(level, { f1: { ...singlePath(fast), throttle: 0.5 } })).toHaveLength(1);
  });
});

describe('the fast stress test of the solver', () => {
  it('earns exactly what the readable one earns', async () => {
    const { FastEvaluator } = await import('./fast');
    const { indexLevel } = await import('./graph');
    for (let seed = 1; seed <= 120; seed += 1) {
      const level = randomLevel(seed, 6 + (seed % 4), 4);
      const index = indexLevel(level);
      const plan = randomPlan(
        level,
        seed * 5,
        level.flows.map((entry) => entry.id),
      );
      const fast = new FastEvaluator(index);
      const slots = level.flows.map((entry) => {
        const flowPlan = plan[entry.id];
        return flowPlan === undefined ? undefined : fast.compile(entry.id, flowPlan);
      });
      const earned = fast.earned(slots);
      const slow = evaluate(index, plan);
      slow.situations.forEach((situation, position) => {
        level.flows.forEach((entry, flowPosition) => {
          const expected = situation.steps.reduce(
            (sum, step) => sum + (step.flows[entry.id]?.value ?? 0),
            0,
          );
          expect(
            earned[position * level.flows.length + flowPosition],
            `seed ${String(seed)}`,
          ).toBeCloseTo(expected, 9);
        });
      });
    }
  });
});

describe('policy: a flow that has to pass a node', () => {
  const guarded = diamond({
    flows: [
      { id: 'f1', name: 'Guest', source: 'A', target: 'D', profile: 'web', demand: 6, via: ['C'] },
    ],
  });

  it('carries nothing on a path that skips the node', () => {
    const skipped = evaluate(guarded, { f1: singlePath(fast) });
    expect(skipped.score).toBe(0);
    expect(evaluate(guarded, { f1: singlePath(slow) }).score).toBeCloseTo(1, 9);
  });

  it('says so when a plan skips the node', () => {
    expect(problemsOfPlan(guarded, { f1: singlePath(fast) })[0]).toContain('skips a node');
    expect(problemsOfPlan(guarded, { f1: singlePath(slow) })).toEqual([]);
  });

  it('is not repaired by the network when its path is cut', () => {
    const cut = diamond({
      flows: guarded.flows,
      situations: [
        {
          id: 'cut',
          name: 'Cut',
          steps: 8,
          events: [{ kind: 'down', link: 'CD', from: 1, to: 8 }],
        },
      ],
    });
    const steps = evaluate(cut, { f1: singlePath(slow) }).situations[0]?.steps ?? [];
    expect(steps[7]?.flows.f1?.delivered).toBe(0);
  });

  it('is measured against strategies that obey the policy, and the fast evaluator agrees', async () => {
    const { shortestPathPlan, loadBalancedPlan } = await import('./baselines');
    const { FastEvaluator } = await import('./fast');
    const { indexLevel } = await import('./graph');
    for (const plan of [shortestPathPlan(guarded), loadBalancedPlan(guarded)]) {
      expect(problemsOfPlan(guarded, plan)).toEqual([]);
    }
    const index = indexLevel(guarded);
    const fastEvaluator = new FastEvaluator(index);
    for (const plan of [{ f1: singlePath(fast) }, { f1: singlePath(slow) }]) {
      const earned = fastEvaluator.earned([fastEvaluator.compile('f1', plan.f1)]);
      const expected = (evaluate(index, plan).situations[0]?.steps ?? []).reduce(
        (sum, step) => sum + (step.flows.f1?.value ?? 0),
        0,
      );
      expect(earned[0]).toBeCloseTo(expected, 9);
    }
  });
});
