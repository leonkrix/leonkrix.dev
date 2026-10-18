import { describe, expect, it } from 'vitest';

import { allRules } from './fixtures';
import { type Family, generateChecked, generateLevel, type LevelSpec } from './generate';
import { problemsOfLevel } from './validate';

function spec(seed: number, overrides: Partial<LevelSpec> = {}): LevelSpec {
  return {
    seed,
    nodes: 9,
    family: 'mesh',
    extraLinks: 0.5,
    profiles: ['voice', 'web', 'video', 'bulk', 'transaction'],
    rules: allRules,
    situations: ['calm', 'rush', 'cut'],
    pressure: 1.2,
    lossyLinks: 1,
    ...overrides,
  };
}

const families: Family[] = ['grid', 'ring', 'hub', 'mesh'];

describe('the level generator', () => {
  it('makes the same level from the same spec', () => {
    expect(generateLevel(spec(5))).toEqual(generateLevel(spec(5)));
    expect(generateLevel(spec(5))).not.toEqual(generateLevel(spec(6)));
  });

  it('makes well formed levels of every family and size', () => {
    for (const family of families) {
      for (let nodes = 4; nodes <= (family === 'hub' || family === 'mesh' ? 14 : 10); nodes += 2) {
        for (let seed = 1; seed <= 6; seed += 1) {
          const { problems } = generateChecked(
            spec(seed * 31 + nodes, {
              nodes,
              family,
              situations: ['calm', 'rush'],
              profiles: ['voice', 'web', 'bulk'],
            }),
          );
          expect(problems, `${family}, ${String(nodes)} nodes, seed ${String(seed)}`).toEqual([]);
        }
      }
    }
  });

  it('makes every kind of situation', () => {
    const level = generateLevel(spec(2, { situations: ['calm', 'rush', 'cut'], lossyLinks: 0 }));
    expect(level.situations.map((situation) => situation.id)).toEqual(['calm', 'rush', 'cut']);
    expect(level.situations[0]?.events).toEqual([]);
    expect(level.situations[1]?.events.every((event) => event.kind === 'burst')).toBe(true);
    expect(level.situations[2]?.events.map((event) => event.kind)).toEqual(['down']);
    for (const kind of ['lossy', 'moving', 'slow'] as const) {
      const other = generateLevel(spec(3, { situations: [kind] }));
      expect(other.situations[0]?.events.length, kind).toBeGreaterThan(0);
      expect(problemsOfLevel(other), kind).toEqual([]);
    }
  });

  it('puts the lossy links in', () => {
    const level = generateLevel(spec(4, { lossyLinks: 2 }));
    expect(level.links.filter((link) => link.loss > 0)).toHaveLength(2);
  });

  it('scales the demand so that the network is under pressure', () => {
    const level = generateLevel(spec(8, { pressure: 1.5 }));
    expect(level.flows.every((flow) => flow.demand >= 1)).toBe(true);
    expect(level.flows.reduce((sum, flow) => sum + flow.demand, 0)).toBeGreaterThan(5);
  });

  it('keeps the drawing inside the box and mostly free of crossing links', () => {
    let crossing = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const level = generateLevel(
        spec(seed, { nodes: 8 + (seed % 5), family: families[seed % 4] ?? 'mesh' }),
      );
      expect(
        level.nodes.every((node) => node.x >= 0 && node.x <= 100 && node.y >= 0 && node.y <= 100),
      ).toBe(true);
      total += 1;
      const at = new Map(level.nodes.map((node) => [node.id, node]));
      const links = level.links.map((link) => [at.get(link.a), at.get(link.b)] as const);
      const orient = (
        p: { x: number; y: number },
        q: { x: number; y: number },
        r: { x: number; y: number },
      ): number => (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x);
      const crosses = links.some((one, position) =>
        links.slice(position + 1).some((two) => {
          const [p1, p2] = one;
          const [p3, p4] = two;
          if (!p1 || !p2 || !p3 || !p4 || p1 === p3 || p1 === p4 || p2 === p3 || p2 === p4) {
            return false;
          }
          return (
            orient(p1, p3, p4) * orient(p2, p3, p4) < 0 &&
            orient(p1, p2, p3) * orient(p1, p2, p4) < 0
          );
        }),
      );
      if (crosses) {
        crossing += 1;
      }
    }
    expect(crossing / total).toBeLessThan(0.1);
  });

  it('reports a spec that cannot make a level', () => {
    expect(generateChecked(spec(1, { nodes: 3 })).problems.length).toBeGreaterThan(0);
  });
});

describe('zones', () => {
  it('make a firewall in the middle and send the flows of the guests through it', () => {
    let withPolicy = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const level = generateLevel(
        spec(seed, {
          nodes: 8,
          family: seed % 2 === 0 ? 'grid' : 'mesh',
          zones: true,
          profiles: ['web', 'web', 'video'],
          situations: ['calm'],
        }),
      );
      expect(level.zones?.map((zone) => zone.id)).toEqual(['guests', 'office', 'servers']);
      expect(level.nodes.every((node) => node.zone !== undefined)).toBe(true);
      const walls = level.nodes.filter((node) => node.kind === 'firewall');
      expect(walls.length).toBeLessThanOrEqual(1);
      const guarded = level.flows.filter((flow) => (flow.via ?? []).length > 0);
      if (guarded.length > 0) {
        withPolicy += 1;
        for (const flow of guarded) {
          expect(flow.via).toEqual([walls[0]?.id]);
        }
      }
    }
    expect(withPolicy).toBeGreaterThan(10);
  });
});
