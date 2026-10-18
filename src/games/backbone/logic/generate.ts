import { createRandom, type Random } from '../../shared/random';
import { indexLevel, shortestPath } from './graph';
import { profiles } from './profiles';
import type {
  Flow,
  Level,
  NetEvent,
  NetLink,
  NetNode,
  NodeKind,
  ProfileId,
  Rules,
  Situation,
} from './types';
import { problemsOfLevel } from './validate';

/**
 * Makes levels from a description (`LevelSpec`) and a seed. The same spec and seed always give the
 * same level. This only builds a well formed level; whether it is a good puzzle is decided by the
 * solver and the level gate (`stars.ts`, `isAdmissible`).
 */

export type Family = 'grid' | 'ring' | 'hub' | 'mesh';

/** What happens in a situation. `calm` has no events. */
export type SituationKind = 'calm' | 'rush' | 'cut' | 'lossy' | 'moving' | 'slow';

export interface LevelSpec {
  seed: number;
  /** 4 to 14 */
  nodes: number;
  family: Family;
  /** Links beyond the minimum that connects the network, as a share of the number of nodes */
  extraLinks: number;
  /** One flow for every entry */
  profiles: readonly ProfileId[];
  rules: Rules;
  situations: readonly SituationKind[];
  /** How loaded the busiest link is when everybody takes the shortest path (1 is exactly full) */
  pressure: number;
  /** Links that lose part of the traffic all the time */
  lossyLinks: number;
  /** How much narrower the middle of every shortest path is than the other roads, 0 to 0.8 (0: not at all) */
  trap?: number;
  title?: string;
  story?: string;
}

interface Point {
  x: number;
  y: number;
}

const SITUATION_NAMES: Record<SituationKind, string> = {
  calm: 'Quiet day',
  rush: 'Rush hour',
  cut: 'Cable cut',
  lossy: 'Bad weather',
  moving: 'On the move',
  slow: 'Congestion',
};

/** Typical demand of a profile before the level is scaled to its pressure. */
const BASE_DEMAND: Record<ProfileId, number> = {
  voice: 2,
  control: 1,
  transaction: 3,
  video: 5,
  web: 4,
  bulk: 8,
};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ccw(a: Point, b: Point, c: Point): number {
  return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
}

/** Whether the segments cross (segments that only share an end point do not). */
function cross(a: readonly [Point, Point], b: readonly [Point, Point]): boolean {
  const [p1, p2] = a;
  const [p3, p4] = b;
  if (p1 === p3 || p1 === p4 || p2 === p3 || p2 === p4) {
    return false;
  }
  return ccw(p1, p3, p4) * ccw(p2, p3, p4) < 0 && ccw(p1, p2, p3) * ccw(p1, p2, p4) < 0;
}

function place(spec: LevelSpec, random: Random): Point[] {
  const count = spec.nodes;
  const jitter = (amount: number): number => (random.next() - 0.5) * amount;
  const points: Point[] = [];
  if (spec.family === 'ring') {
    for (let position = 0; position < count; position += 1) {
      const angle = (position / count) * 2 * Math.PI - Math.PI / 2;
      points.push({ x: 50 + 40 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) });
    }
  } else if (spec.family === 'hub') {
    points.push({ x: 50, y: 50 });
    const outer = count - 1;
    for (let position = 0; position < outer; position += 1) {
      const angle = (position / outer) * 2 * Math.PI - Math.PI / 2;
      const radius = position % 2 === 0 ? 40 : 24;
      points.push({ x: 50 + radius * Math.cos(angle), y: 50 + radius * 0.95 * Math.sin(angle) });
    }
  } else if (spec.family === 'grid') {
    const columns = Math.ceil(Math.sqrt(count * 1.6));
    const rows = Math.ceil(count / columns);
    for (let position = 0; position < count; position += 1) {
      const column = position % columns;
      const row = Math.floor(position / columns);
      points.push({
        x: 12 + (column * 76) / Math.max(1, columns - 1) + jitter(8),
        y: 14 + (row * 72) / Math.max(1, rows - 1) + jitter(8),
      });
    }
  } else {
    const minimum = 62 / Math.sqrt(count);
    for (let attempts = 0; points.length < count && attempts < 4000; attempts += 1) {
      const candidate = { x: 8 + random.next() * 84, y: 10 + random.next() * 80 };
      const factor = attempts > 2000 ? 0.6 : 1;
      if (points.every((other) => distance(other, candidate) >= minimum * factor)) {
        points.push(candidate);
      }
    }
    while (points.length < count) {
      points.push({ x: 8 + random.next() * 84, y: 10 + random.next() * 80 });
    }
  }
  return points.map((point) => ({
    x: Math.round(Math.min(96, Math.max(4, point.x)) * 10) / 10,
    y: Math.round(Math.min(96, Math.max(4, point.y)) * 10) / 10,
  }));
}

/** The pairs of node numbers to join: a connected network without crossings where possible. */
function connect(points: readonly Point[], extra: number): [number, number][] {
  const count = points.length;
  const pairs: [number, number][] = [];
  for (let a = 0; a < count; a += 1) {
    for (let b = a + 1; b < count; b += 1) {
      pairs.push([a, b]);
    }
  }
  const at = (n: number): Point => points[n] ?? { x: 0, y: 0 };
  pairs.sort(
    (p, q) =>
      distance(at(p[0]), at(p[1])) - distance(at(q[0]), at(q[1])) || p[0] - q[0] || p[1] - q[1],
  );
  const edges: [number, number][] = [];
  const degree = new Array<number>(count).fill(0);
  const group = Array.from({ length: count }, (_, position) => position);
  const find = (n: number): number => {
    let root = n;
    while ((group[root] ?? root) !== root) {
      root = group[root] ?? root;
    }
    return root;
  };
  const crossesAny = (pair: readonly [number, number]): boolean =>
    edges.some((edge) => cross([at(pair[0]), at(pair[1])], [at(edge[0]), at(edge[1])]));
  const add = (pair: [number, number]): void => {
    edges.push(pair);
    degree[pair[0]] = (degree[pair[0]] ?? 0) + 1;
    degree[pair[1]] = (degree[pair[1]] ?? 0) + 1;
    group[find(pair[0])] = find(pair[1]);
  };
  for (const pair of pairs) {
    if (find(pair[0]) !== find(pair[1]) && !crossesAny(pair)) {
      add(pair);
    }
  }
  // If crossings blocked the connection, join what is left by the shortest pairs, crossing or not.
  for (const pair of pairs) {
    if (find(pair[0]) !== find(pair[1])) {
      add(pair);
    }
  }
  let added = 0;
  for (const pair of pairs) {
    if (added >= extra) {
      break;
    }
    const exists = edges.some((edge) => edge[0] === pair[0] && edge[1] === pair[1]);
    if (!exists && (degree[pair[0]] ?? 0) < 4 && (degree[pair[1]] ?? 0) < 4 && !crossesAny(pair)) {
      add(pair);
      added += 1;
    }
  }
  return edges;
}

function farthestPair(points: readonly Point[]): [number, number] {
  let best: [number, number] = [0, Math.min(1, points.length - 1)];
  let longest = -1;
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      const length = distance(points[a] ?? { x: 0, y: 0 }, points[b] ?? { x: 0, y: 0 });
      if (length > longest) {
        longest = length;
        best = [a, b];
      }
    }
  }
  return best;
}

function buildNetwork(spec: LevelSpec, random: Random): { nodes: NetNode[]; links: NetLink[] } {
  const points = place(spec, random);
  const edges = connect(
    points,
    Math.max(spec.family === 'ring' ? 1 : 0, Math.round(spec.extraLinks * spec.nodes)),
  );
  const degree = new Array<number>(spec.nodes).fill(0);
  for (const [a, b] of edges) {
    degree[a] = (degree[a] ?? 0) + 1;
    degree[b] = (degree[b] ?? 0) + 1;
  }
  const [first, second] = farthestPair(points);
  const servers = new Set<number>(spec.nodes >= 9 ? [first, second] : [first]);

  const kinds: NodeKind[] = [];
  const counters: Record<NodeKind, number> = {
    router: 0,
    switch: 0,
    server: 0,
    client: 0,
    firewall: 0,
    radio: 0,
  };
  const nodes: NetNode[] = points.map((point, position) => {
    let kind: NodeKind;
    if (servers.has(position)) {
      kind = 'server';
    } else if ((degree[position] ?? 0) <= 1) {
      kind = 'client';
    } else if ((degree[position] ?? 0) >= 3 && random.next() < 0.35) {
      kind = 'switch';
    } else {
      kind = 'router';
    }
    kinds.push(kind);
    counters[kind] += 1;
    const label = {
      router: 'R',
      switch: 'S',
      server: 'Srv',
      client: 'C',
      firewall: 'F',
      radio: 'Rad',
    }[kind];
    return {
      id: `n${String(position)}`,
      name: `${label}${String(counters[kind])}`,
      kind,
      x: point.x,
      y: point.y,
    };
  });

  const lossyPicks = new Set<number>();
  while (lossyPicks.size < Math.min(spec.lossyLinks, edges.length)) {
    lossyPicks.add(random.int(edges.length));
  }
  const links: NetLink[] = edges.map(([a, b], position) => {
    const length = distance(points[a] ?? { x: 0, y: 0 }, points[b] ?? { x: 0, y: 0 });
    const core = (degree[a] ?? 0) >= 3 && (degree[b] ?? 0) >= 3;
    return {
      id: `l${String(position)}`,
      a: `n${String(a)}`,
      b: `n${String(b)}`,
      capacity: 5 + random.int(6) + (core ? 3 : 0),
      delay: Math.min(4, Math.max(1, Math.round(length / 16))),
      loss: lossyPicks.has(position) ? (random.next() < 0.5 ? 0.1 : 0.2) : 0,
    };
  });
  return { nodes, links };
}

function buildFlows(spec: LevelSpec, nodes: readonly NetNode[], random: Random): Flow[] {
  const servers = nodes.filter((node) => node.kind === 'server');
  const flows: Flow[] = spec.profiles.map((profile, position) => {
    const target =
      random.next() < 0.75 && servers.length > 0 ? random.pick(servers) : random.pick(nodes);
    const far = nodes.filter(
      (node) =>
        node.id !== target.id &&
        node.kind !== 'server' &&
        Math.hypot(node.x - target.x, node.y - target.y) > 30,
    );
    const pool = far.length > 0 ? far : nodes.filter((node) => node.id !== target.id);
    const source = random.pick(pool);
    return {
      id: `f${String(position)}`,
      name: `${profiles[profile].name} ${String(position + 1)}`,
      source: source.id,
      target: target.id,
      profile,
      demand: BASE_DEMAND[profile],
    };
  });
  return flows;
}

/** Scales the demands so that the busiest link is `pressure` times full when all take the shortest path. */
function scaleDemand(level: Level, pressure: number): Level {
  const index = indexLevel(level);
  const load = new Map<string, number>();
  for (const flow of level.flows) {
    const path = shortestPath(index, flow.source, flow.target) ?? [];
    for (let position = 1; position < path.length; position += 1) {
      const step = index.neighbours
        .get(path[position - 1] ?? '')
        ?.find((entry) => entry.node === path[position]);
      if (step !== undefined) {
        load.set(step.link, (load.get(step.link) ?? 0) + flow.demand);
      }
    }
  }
  let busiest = 0;
  for (const [id, value] of load) {
    busiest = Math.max(busiest, value / (index.linkById.get(id)?.capacity ?? 1));
  }
  if (busiest === 0) {
    return level;
  }
  const factor = pressure / busiest;
  return {
    ...level,
    flows: level.flows.map((flow) => ({
      ...flow,
      demand: Math.max(1, Math.round(flow.demand * factor)),
    })),
  };
}

/** Makes the shortest path of every flow narrow in its middle, so that the fast way is the full one. */
function narrowShortcuts(level: Level, trap: number): Level {
  if (trap <= 0) {
    return level;
  }
  const index = indexLevel(level);
  const narrow = new Set<string>();
  for (const flow of level.flows) {
    const path = shortestPath(index, flow.source, flow.target) ?? [];
    const middle = Math.floor((path.length - 1) / 2);
    const step = index.neighbours
      .get(path[middle] ?? '')
      ?.find((entry) => entry.node === path[middle + 1]);
    if (step !== undefined) {
      narrow.add(step.link);
    }
  }
  return {
    ...level,
    links: level.links.map((link) =>
      narrow.has(link.id)
        ? { ...link, capacity: Math.max(3, Math.round(link.capacity * (1 - trap))) }
        : link,
    ),
  };
}

function eventsFor(kind: SituationKind, level: Level, steps: number, random: Random): NetEvent[] {
  const index = indexLevel(level);
  const onShortestPaths = [
    ...new Set(
      level.flows.flatMap((flow) => {
        const path = shortestPath(index, flow.source, flow.target) ?? [];
        return path.slice(1).flatMap((node, position) => {
          const step = index.neighbours
            .get(path[position] ?? '')
            ?.find((entry) => entry.node === node);
          return step === undefined ? [] : [step.link];
        });
      }),
    ),
  ];
  const candidates =
    onShortestPaths.length > 0 ? onShortestPaths : level.links.map((link) => link.id);
  const keepsConnected = (...cut: string[]): boolean =>
    level.flows.every(
      (flow) =>
        shortestPath(index, flow.source, flow.target, (id) => !cut.includes(id)) !== undefined,
    );
  const order = random.shuffle(candidates);
  switch (kind) {
    case 'calm':
      return [];
    case 'rush': {
      const heavy = level.flows.filter(
        (flow) => flow.profile !== 'voice' && flow.profile !== 'control',
      );
      const pool = random.shuffle(heavy.length > 0 ? heavy : level.flows);
      return pool.slice(0, Math.min(2, pool.length)).map((flow) => ({
        kind: 'burst',
        flow: flow.id,
        from: 3,
        to: Math.min(steps, 6),
        factor: 2,
      }));
    }
    case 'cut': {
      const link = order.find((id) => keepsConnected(id)) ?? order[0];
      return link === undefined ? [] : [{ kind: 'down', link, from: 2, to: steps - 2 }];
    }
    case 'lossy': {
      const link = order[0];
      return link === undefined ? [] : [{ kind: 'lossy', link, from: 1, to: steps - 1, loss: 0.2 }];
    }
    case 'slow': {
      const link = order[0];
      return link === undefined
        ? []
        : [{ kind: 'slow', link, from: 2, to: Math.min(steps, 6), factor: 0.5 }];
    }
    case 'moving': {
      const safe = order.filter((id) => keepsConnected(id));
      const [away, later] = [safe[0], safe[1]];
      const events: NetEvent[] = [];
      if (away !== undefined) {
        events.push({ kind: 'down', link: away, from: Math.floor(steps / 2), to: steps });
      }
      if (later !== undefined && keepsConnected(later)) {
        events.push({
          kind: 'down',
          link: later,
          from: 0,
          to: Math.max(1, Math.floor(steps / 2) - 1),
        });
      }
      return events;
    }
  }
}

export function generateLevel(spec: LevelSpec): Level {
  const random = createRandom(spec.seed);
  const { nodes, links } = buildNetwork(spec, random);
  const base: Level = {
    id: `generated-${String(spec.seed)}`,
    title: spec.title ?? 'Generated level',
    story: spec.story ?? '',
    nodes,
    links,
    flows: buildFlows(spec, nodes, random),
    situations: [],
    rules: spec.rules,
  };
  const scaled = scaleDemand(narrowShortcuts(base, spec.trap ?? 0), spec.pressure);
  const situations: Situation[] = spec.situations.map((kind) => {
    const steps = kind === 'calm' ? 6 : 8;
    return {
      id: kind,
      name: SITUATION_NAMES[kind],
      steps,
      events: eventsFor(kind, scaled, steps, random),
    };
  });
  return { ...scaled, situations };
}

/** Why a spec cannot make a good level, or an empty list. */
export function problemsOfSpec(spec: LevelSpec): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(spec.nodes) || spec.nodes < 4 || spec.nodes > 14) {
    problems.push('a level has 4 to 14 nodes');
  }
  if (spec.profiles.length < 1 || spec.profiles.length > 10) {
    problems.push('a level has 1 to 10 flows');
  }
  if (spec.situations.length < 1 || spec.situations.length > 3) {
    problems.push('a level has 1 to 3 situations');
  }
  return problems;
}

/** The level and what is wrong with it (an empty list when it is well formed). */
export function generateChecked(spec: LevelSpec): { level: Level; problems: string[] } {
  const level = generateLevel(spec);
  return { level, problems: [...problemsOfSpec(spec), ...problemsOfLevel(level)] };
}
