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
    const packets = packetsAt(calmIndex, need(step), 0.3);
    expect(packets.length).toBeGreaterThan(0);
    expect(packets.every((packet) => packet.point.y <= 40 + 1e-9)).toBe(true);
  });

  it('drops the packets that do not fit before the end of the full link', () => {
    const result = evaluate(calmIndex, { f1: singlePath(['A', 'B', 'D']) });
    const step = result.situations[0]?.steps[0];
    const all = [0, 0.2, 0.4, 0.6, 0.8].flatMap((time) => packetsAt(calmIndex, need(step), time));
    expect(all.some((packet) => packet.dropped)).toBe(true);
    expect(all.some((packet) => !packet.dropped)).toBe(true);
  });

  it('shows no dropped packets when everything fits', () => {
    const fits = diamond({
      flows: [{ id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 6 }],
    });
    const fitsIndex = indexLevel(fits);
    const step = evaluate(fitsIndex, { f1: singlePath(['A', 'B', 'D']) }).situations[0]?.steps[0];
    const all = [0, 0.25, 0.5, 0.75].flatMap((time) => packetsAt(fitsIndex, need(step), time));
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
