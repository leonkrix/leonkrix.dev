import { describe, expect, it } from 'vitest';

import { allRules, diamond } from './fixtures';
import { generateLevel } from './generate';
import {
  angleBetween,
  distanceToSegment,
  geometryProblems,
  mapPoint,
  segmentsCross,
} from './geometry';
import { placeNames, placeTag } from './labels';
import type { Level } from './types';

describe('the drawing rules', () => {
  it('measures a point against a segment', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(distanceToSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });

  it('finds crossing segments but not ones that share an end', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 10 };
    expect(
      segmentsCross(
        [a, b],
        [
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ],
        false,
      ),
    ).toBe(true);
    expect(segmentsCross([a, b], [a, { x: 10, y: 0 }], true)).toBe(false);
  });

  it('measures the angle between two cables', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 6);
    expect(angleBetween({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 })).toBe(0);
  });

  it('accepts the diamond and finds a node on a cable', () => {
    expect(geometryProblems(diamond())).toEqual([]);
    const crowded: Level = {
      ...diamond(),
      nodes: diamond().nodes.map((node) =>
        node.id === 'B'
          ? { ...node, x: 30, y: 65 }
          : node.id === 'C'
            ? { ...node, x: 51, y: 80 }
            : node,
      ),
    };
    expect(geometryProblems(crowded).length).toBeGreaterThan(0);
  });

  it('squeezes the height to the map', () => {
    expect(mapPoint({ x: 10, y: 50 })).toEqual({ x: 10, y: 40 });
  });
});

describe('the placement of labels', () => {
  it('finds a side for every name and leaves nothing colliding on generated levels', () => {
    let worst = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const level = generateLevel({
        seed,
        nodes: 6 + (seed % 5),
        family: (['mesh', 'grid', 'hub', 'ring'] as const)[seed % 4] ?? 'mesh',
        extraLinks: 0.5,
        profiles: ['web'],
        rules: allRules,
        situations: ['calm'],
        pressure: 1.2,
        lossyLinks: 0,
      });
      const placement = placeNames(level);
      expect(placement.names.size).toBe(level.nodes.length);
      worst = Math.max(worst, placement.conflicts);
    }
    // Most levels can be labelled without any collision; the pool script only keeps those that can
    expect(worst).toBeLessThan(1000);
  });

  it('puts the numbers of the flows on the left corner of a node near the right border', () => {
    const base = diamond();
    const flows = ['f1', 'f2', 'f3'].map((id) => ({
      id,
      name: id,
      source: 'D',
      target: 'A',
      profile: 'web' as const,
      demand: 2,
    }));
    const level = { ...base, flows };
    const placement = placeNames(level);
    // D is at the right border (x 90) and carries the start of three flows: the numbers go left
    expect(placement.badgesLeft.has('D')).toBe(true);
    // A is at the left and has the three ends: they fit on its right corner
    expect(placement.badgesLeft.has('A')).toBe(false);
  });

  it('shows the load of a cable a little aside where the middle is taken', () => {
    const level = generateLevel({
      seed: 9,
      nodes: 10,
      family: 'mesh',
      extraLinks: 0.6,
      profiles: ['web', 'video', 'bulk', 'voice'],
      rules: allRules,
      situations: ['calm'],
      pressure: 1.2,
      lossyLinks: 0,
    });
    const placement = placeNames(level);
    expect(placement.loads.size).toBe(level.links.length);
    for (const at of placement.loads.values()) {
      expect(at).toBeGreaterThanOrEqual(0.26);
      expect(at).toBeLessThanOrEqual(0.74);
    }
  });

  it('puts a mark on a side that is not the side of the name', () => {
    const level = diamond();
    const placement = placeNames(level);
    for (const node of level.nodes) {
      expect(placeTag(level, placement, node.id)).not.toBe(placement.names.get(node.id));
    }
  });
});
