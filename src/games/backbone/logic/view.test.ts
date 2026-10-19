import { describe, expect, it } from 'vitest';

import { diamond } from './fixtures';
import { indexLevel } from './graph';
import { singlePath } from './plan';
import { evaluate } from './simulate';
import {
  advanceClock,
  along,
  linkBetween,
  loadClass,
  loadRatio,
  nodeInDirection,
  nodesOfLinks,
  packetsAt,
  pointOf,
  polyline,
} from './view';

const level = diamond();
const index = indexLevel(level);

describe('the geometry of the drawing', () => {
  it('squeezes the height of a node to the map', () => {
    expect(pointOf({ id: 'x', name: 'x', kind: 'router', x: 10, y: 50 })).toEqual({ x: 10, y: 40 });
  });

  it('finds the nodes of a path from its links', () => {
    expect(nodesOfLinks(index, 'A', ['AB', 'BD'])).toEqual(['A', 'B', 'D']);
    expect(nodesOfLinks(index, 'D', ['CD', 'AC'])).toEqual(['D', 'C', 'A']);
  });

  it('walks along a polyline', () => {
    const points = polyline(index, ['A', 'B', 'D']);
    expect(along(points, 0)).toEqual(points[0]);
    expect(along(points, 1)).toEqual(points[2]);
    const middle = along(points, 0.5);
    expect(middle.x).toBeCloseTo(50, 5);
  });

  it('finds the link between two nodes', () => {
    expect(linkBetween(level, 'B', 'A')).toBe('AB');
    expect(linkBetween(level, 'A', 'D')).toBeUndefined();
  });
});

describe('load', () => {
  it('divides what wants a link by what it carries', () => {
    expect(loadRatio({ offered: 5, capacity: 10 })).toBe(0.5);
    expect(loadRatio({ offered: 0, capacity: 0 })).toBe(0);
    expect(loadRatio({ offered: 3, capacity: 0 })).toBe(Infinity);
    expect(loadRatio(undefined)).toBe(0);
  });

  it('sorts it into four classes', () => {
    expect(loadClass(0)).toBe('idle');
    expect(loadClass(0.5)).toBe('ok');
    expect(loadClass(0.7)).toBe('ok');
    expect(loadClass(0.9)).toBe('busy');
    expect(loadClass(1)).toBe('busy');
    expect(loadClass(1.2)).toBe('over');
    expect(loadClass(Infinity)).toBe('over');
  });
});

describe('keyboard movement', () => {
  it('moves to the neighbour that lies in the direction', () => {
    expect(nodeInDirection(index, 'A', 'right')).toBeDefined();
    expect(nodeInDirection(index, 'A', 'up')).toBe('B');
    expect(nodeInDirection(index, 'A', 'down')).toBe('C');
    expect(nodeInDirection(index, 'B', 'down')).not.toBe('B');
  });

  it('does not move where nothing lies', () => {
    expect(nodeInDirection(index, 'A', 'left')).toBeUndefined();
  });
});

function need<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('expected a value');
  }
  return value;
}

describe('packets', () => {
  const calm = diamond({
    flows: [{ id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 16 }],
  });
  const calmIndex = indexLevel(calm);

  it('shows a few packets on the path and none off it', () => {
    const result = evaluate(calmIndex, { f1: singlePath(['A', 'B', 'D']) });
    const step = result.situations[0]?.steps[0];
    expect(step).toBeDefined();
    const packets = packetsAt(calmIndex, need(calm.situations[0]), [need(step)], 0, 0.3);
    expect(packets.length).toBeGreaterThan(0);
    expect(packets.every((packet) => packet.point.y <= 40 + 1e-9)).toBe(true);
  });

  it('drops the packets that do not fit before the end of the full link', () => {
    const result = evaluate(calmIndex, { f1: singlePath(['A', 'B', 'D']) });
    const step = result.situations[0]?.steps[0];
    const all = [0, 0.2, 0.4, 0.6, 0.8].flatMap((time) =>
      packetsAt(calmIndex, need(calm.situations[0]), [need(step)], 0, time),
    );
    expect(all.some((packet) => packet.dropped)).toBe(true);
    expect(all.some((packet) => !packet.dropped)).toBe(true);
  });

  it('shows no dropped packets when everything fits', () => {
    const fits = diamond({
      flows: [{ id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 6 }],
    });
    const fitsIndex = indexLevel(fits);
    const step = evaluate(fitsIndex, { f1: singlePath(['A', 'B', 'D']) }).situations[0]?.steps[0];
    const all = [0, 0.25, 0.5, 0.75].flatMap((time) =>
      packetsAt(fitsIndex, need(fits.situations[0]), [need(step)], 0, time),
    );
    expect(all.some((packet) => packet.dropped)).toBe(false);
  });
});

describe('the clock of the stress test', () => {
  it('runs through the steps and on into the next situation', () => {
    const steps = [3, 2];
    let clock = { situation: 0, step: 0, time: 0 };
    clock = advanceClock(steps, clock, 0.5).clock;
    expect(clock).toEqual({ situation: 0, step: 0, time: 0.5 });
    clock = advanceClock(steps, clock, 1).clock;
    expect(clock.step).toBe(1);
    clock = advanceClock(steps, clock, 2).clock;
    expect(clock.situation).toBe(1);
    expect(clock.step).toBe(0);
  });

  it('stops on the last step of the last situation', () => {
    const result = advanceClock([2], { situation: 0, step: 1, time: 0.5 }, 1);
    expect(result.finished).toBe(true);
    expect(result.clock).toEqual({ situation: 0, step: 1, time: 0 });
  });
});

describe('packets over several steps', () => {
  // A burst of web traffic in the steps 2 and 3 of five
  const burst = diamond({
    flows: [{ id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 4 }],
    situations: [
      {
        id: 'rush',
        name: 'Rush',
        steps: 5,
        events: [{ kind: 'burst', flow: 'f1', from: 1, to: 3, factor: 3 }],
      },
    ],
  });
  const burstIndex = indexLevel(burst);
  const steps = need(evaluate(burstIndex, { f1: singlePath(['A', 'B', 'D']) }).situations[0]).steps;
  const situation = need(burst.situations[0]);

  it('sends more packets in a burst', () => {
    const quiet = packetsAt(burstIndex, situation, steps, 0, 0.9).length;
    const busy = packetsAt(burstIndex, situation, steps, 1, 0.9).length;
    expect(busy).toBeGreaterThan(quiet);
  });

  it('lets the packets of a step go on to their target when the step is over', () => {
    for (const boundary of [1, 2, 3, 4]) {
      const before = packetsAt(burstIndex, situation, steps, boundary - 1, 0.9999);
      const after = packetsAt(burstIndex, situation, steps, boundary, 0.0001);
      for (const packet of before) {
        // A packet that has not reached its target is still there, a hair further on
        const still = after.find((other) => other.key === packet.key);
        if (packet.point.x < 89) {
          expect(still, packet.key + ' at the end of step ' + String(boundary - 1)).toBeDefined();
          expect(still?.point.x).toBeGreaterThanOrEqual(packet.point.x - 1e-6);
        }
      }
    }
  });
});

describe('packets that a cable loses', () => {
  const lossy = diamond({
    flows: [{ id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 8 }],
    links: [
      { id: 'AB', a: 'A', b: 'B', capacity: 10, delay: 1, loss: 0.5 },
      { id: 'BD', a: 'B', b: 'D', capacity: 10, delay: 1, loss: 0 },
      { id: 'AC', a: 'A', b: 'C', capacity: 10, delay: 2, loss: 0 },
      { id: 'CD', a: 'C', b: 'D', capacity: 10, delay: 2, loss: 0 },
    ],
  });
  const lossyIndex = indexLevel(lossy);
  const steps = need(evaluate(lossyIndex, { f1: singlePath(['A', 'B', 'D']) }).situations[0]).steps;
  const situation = need(lossy.situations[0]);

  it('fades some of them on the cable, in the share of the loss, a little bigger', () => {
    const all = [0.55, 0.65, 0.75, 0.85, 0.95].flatMap((time) =>
      packetsAt(lossyIndex, situation, steps, 0, time),
    );
    const lost = all.filter((packet) => packet.dropped);
    expect(lost.length).toBeGreaterThan(0);
    // They are lost on the first cable (A to B lies between x 10 and 50), never behind it
    expect(lost.every((packet) => packet.point.x <= 50 + 1e-6)).toBe(true);
    expect(lost.some((packet) => packet.scale > 1)).toBe(true);
    expect(all.some((packet) => !packet.dropped)).toBe(true);
  });
});

describe('packets follow the delay of the route', () => {
  // Two ways from A to D: A-B-D takes 1 + 1, A-C-D takes 4 + 4
  const levelOf = (profile: 'web' | 'bulk', demand: number, loss = 0) =>
    diamond({
      flows: [{ id: 'f1', name: 'Flow', source: 'A', target: 'D', profile, demand }],
      links: [
        { id: 'AB', a: 'A', b: 'B', capacity: 30, delay: 1, loss },
        { id: 'BD', a: 'B', b: 'D', capacity: 30, delay: 1, loss: 0 },
        { id: 'AC', a: 'A', b: 'C', capacity: 30, delay: 4, loss: 0 },
        { id: 'CD', a: 'C', b: 'D', capacity: 30, delay: 4, loss: 0 },
      ],
      situations: [{ id: 'calm', name: 'Calm', steps: 8, events: [] }],
    });
  const stepsOf = (level: ReturnType<typeof levelOf>, plan: Parameters<typeof evaluate>[1]) =>
    need(evaluate(indexLevel(level), plan).situations[0]).steps;

  it('has more packets under way on a longer route, at the same rhythm', () => {
    const level = levelOf('web', 8);
    const short = stepsOf(level, { f1: singlePath(['A', 'B', 'D']) });
    const long = stepsOf(level, { f1: singlePath(['A', 'C', 'D']) });
    const count = (steps: typeof short): number =>
      packetsAt(indexLevel(level), need(level.situations[0]), steps, 5, 0.5).length;
    expect(count(long)).toBeGreaterThan(count(short));
    // The rhythm is the same: the packets of one minute leave at the same moments on both routes
    const leaves = (steps: typeof short): number[] => {
      const found = new Set<number>();
      for (const time of [0.2, 0.4, 0.6, 0.8, 0.99]) {
        for (const packet of packetsAt(
          indexLevel(level),
          need(level.situations[0]),
          steps,
          5,
          time,
        )) {
          const [, , at, number] = packet.key.split(':');
          if (at === '5') {
            found.add(Number(number));
          }
        }
      }
      return [...found].sort((a, b) => a - b);
    };
    expect(leaves(long)).toEqual(leaves(short));
  });

  it('sends as many packets over the two paths of an even split', () => {
    const level = levelOf('web', 8);
    const split = {
      f1: {
        stages: [
          {
            from: 0,
            paths: [
              { nodes: ['A', 'B', 'D'], share: 0.5 },
              { nodes: ['A', 'C', 'D'], share: 0.5 },
            ],
          },
        ],
        redundancy: 0 as const,
        throttle: 1,
      },
    };
    const steps = stepsOf(level, split);
    // Count what leaves in step 5, one packet at a time (the keys name the step and the path)
    const left = new Map<string, number>();
    for (const time of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      for (const packet of packetsAt(
        indexLevel(level),
        need(level.situations[0]),
        steps,
        5,
        time,
      )) {
        const [, path, at] = packet.key.split(':');
        if (at === '5') {
          left.set(path ?? '', (left.get(path ?? '') ?? 0) + 1);
        }
      }
    }
    expect(left.get('0')).toBeGreaterThan(0);
    expect(left.get('1')).toBeGreaterThan(0);
  });

  it('sends extra coded packets with redundancy', () => {
    const level = levelOf('web', 8);
    const plan = (redundancy: 0 | 0.5) => ({
      f1: { ...singlePath(['A', 'B', 'D']), redundancy },
    });
    const at = (redundancy: 0 | 0.5) =>
      packetsAt(
        indexLevel(level),
        need(level.situations[0]),
        stepsOf(level, plan(redundancy)),
        5,
        0.9,
      );
    expect(at(0.5).length).toBeGreaterThan(at(0).length);
    expect(at(0.5).some((packet) => packet.coded)).toBe(true);
    expect(at(0).some((packet) => packet.coded)).toBe(false);
  });

  it('loses about the share of a lossy cable, spread over the packets', () => {
    const level = levelOf('web', 10, 0.2);
    const steps = stepsOf(level, { f1: singlePath(['A', 'B', 'D']) });
    const seen = new Map<string, boolean>();
    for (let step = 0; step < 8; step += 1) {
      for (const time of [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]) {
        for (const packet of packetsAt(
          indexLevel(level),
          need(level.situations[0]),
          steps,
          step,
          time,
        )) {
          seen.set(packet.key, packet.dropped);
        }
      }
    }
    const share = [...seen.values()].filter(Boolean).length / seen.size;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.3);
  });
});
