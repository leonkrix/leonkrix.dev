import { createRandom } from '../../shared/random';
import { candidatePaths, indexLevel } from './graph';
import { profileIds } from './profiles';
import type { Flow, FlowPlan, Level, NetLink, NetNode, Plan, Redundancy, Rules } from './types';

/**
 * Small levels for the tests. `diamond` is the smallest network where routing matters: two ways
 * from A to D, a fast one (through B) and a slower one (through C).
 */
export const allRules: Rules = {
  split: true,
  backup: true,
  redundancy: true,
  throttle: true,
  stages: true,
  queues: true,
};

export function diamond(overrides: Partial<Level> = {}): Level {
  const nodes: NetNode[] = [
    { id: 'A', name: 'A', kind: 'router', x: 10, y: 50 },
    { id: 'B', name: 'B', kind: 'router', x: 50, y: 20 },
    { id: 'C', name: 'C', kind: 'router', x: 50, y: 80 },
    { id: 'D', name: 'D', kind: 'router', x: 90, y: 50 },
  ];
  const links: NetLink[] = [
    { id: 'AB', a: 'A', b: 'B', capacity: 10, delay: 1, loss: 0 },
    { id: 'BD', a: 'B', b: 'D', capacity: 10, delay: 1, loss: 0 },
    { id: 'AC', a: 'A', b: 'C', capacity: 10, delay: 2, loss: 0 },
    { id: 'CD', a: 'C', b: 'D', capacity: 10, delay: 2, loss: 0 },
  ];
  const flows: Flow[] = [
    { id: 'f1', name: 'Web', source: 'A', target: 'D', profile: 'web', demand: 8 },
  ];
  return {
    id: 'diamond',
    title: 'Diamond',
    story: 'Four routers and two ways through.',
    nodes,
    links,
    flows,
    situations: [{ id: 'calm', name: 'Calm', steps: 6, events: [] }],
    // Without queues: what does not fit is dropped (a test that needs a queue switches it on)
    rules: { ...allRules, queues: false },
    ...overrides,
  };
}

/** A random level: a ring with chords, some lossy links, flows of every profile, a possible cut. */
export function randomLevel(seed: number, nodeCount = 7, flowCount = 4): Level {
  const random = createRandom(seed);
  const nodes: NetNode[] = Array.from({ length: nodeCount }, (_, position) => ({
    id: `n${String(position)}`,
    name: `N${String(position)}`,
    kind: 'router',
    x: 50 + 40 * Math.cos((position / nodeCount) * 2 * Math.PI),
    y: 50 + 40 * Math.sin((position / nodeCount) * 2 * Math.PI),
  }));
  const links: NetLink[] = [];
  const has = (a: string, b: string): boolean =>
    links.some((link) => (link.a === a && link.b === b) || (link.a === b && link.b === a));
  const add = (a: string, b: string): void => {
    links.push({
      id: `l${String(links.length)}`,
      a,
      b,
      capacity: 4 + random.int(7),
      delay: 1 + random.int(3),
      loss: random.next() < 0.25 ? 0.1 : 0,
    });
  };
  for (let position = 0; position < nodeCount; position += 1) {
    add(`n${String(position)}`, `n${String((position + 1) % nodeCount)}`);
  }
  for (let chord = 0; chord < nodeCount; chord += 1) {
    const a = `n${String(random.int(nodeCount))}`;
    const b = `n${String(random.int(nodeCount))}`;
    if (a !== b && !has(a, b)) {
      add(a, b);
    }
  }
  const flows: Flow[] = Array.from({ length: flowCount }, (_, position) => {
    const source = random.int(nodeCount);
    const target = (source + 1 + random.int(nodeCount - 1)) % nodeCount;
    return {
      id: `f${String(position)}`,
      name: `Flow ${String(position)}`,
      source: `n${String(source)}`,
      target: `n${String(target)}`,
      profile: random.pick(profileIds),
      demand: 1 + random.int(5),
    };
  });
  const cut = random.pick(links);
  const burst = random.pick(flows);
  return {
    id: `random-${String(seed)}`,
    title: 'Random',
    story: '',
    rules: allRules,
    nodes,
    links,
    flows,
    situations: [
      { id: 'calm', name: 'Calm', steps: 6, events: [] },
      {
        id: 'rush',
        name: 'Rush',
        steps: 8,
        events: [
          { kind: 'down', link: cut.id, from: 2, to: 6 },
          { kind: 'burst', flow: burst.id, from: 3, to: 5, factor: 2 },
        ],
      },
      {
        id: 'attack',
        name: 'Attack',
        steps: 8,
        events: [
          {
            kind: 'flood',
            source: 'n0',
            target: `n${String(Math.floor(nodeCount / 2))}`,
            from: 1,
            to: 6,
            rate: 4,
          },
        ],
      },
    ],
  };
}

/** A random plan for the given flows (the others are left out), made from the candidate paths. */
export function randomPlan(level: Level, seed: number, only?: readonly string[]): Plan {
  const random = createRandom(seed);
  const index = indexLevel(level);
  const plan: Record<string, FlowPlan> = {};
  for (const flow of level.flows) {
    const choice = random.next();
    if (only !== undefined ? !only.includes(flow.id) : choice < 0.15) {
      continue;
    }
    const paths = candidatePaths(index, flow.source, flow.target, 4);
    const first = random.pick(paths);
    const second = random.pick(paths);
    const split = second !== first && random.next() < 0.4;
    plan[flow.id] = {
      stages: [
        {
          from: 0,
          paths: split
            ? [
                { nodes: first, share: 0.5 },
                { nodes: second, share: 0.5 },
              ]
            : [{ nodes: first, share: 1 }],
        },
      ],
      ...(random.next() < 0.3 ? { backup: random.pick(paths) } : {}),
      redundancy: random.pick<Redundancy>([0, 0.25, 0.5]),
      throttle: flow.profile === 'bulk' && random.next() < 0.4 ? 0.5 : 1,
    };
  }
  return plan;
}
