import { createRandom, type Random } from '../../shared/random';
import { floodLinks } from './flood';
import {
  angleBetween,
  distance,
  distanceToSegment,
  EDGE_CLEARANCE,
  mapPoint,
  MIN_ANGLE,
  NODE_MIN_DISTANCE,
  type Point,
  segmentsCross,
} from './geometry';
import { indexLevel, shortestPath } from './graph';
import { latticePoints } from './lattice';
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
  Zone,
} from './types';
import { problemsOfLevel } from './validate';

/**
 * Makes levels from a description (`LevelSpec`) and a seed. The same spec and seed always give the
 * same level. This only builds a well formed level; whether it is a good puzzle is decided by the
 * solver and the level gate (`stars.ts`, `isAdmissible`).
 */

export type Family = 'grid' | 'ring' | 'hub' | 'mesh';

/** What happens in a situation. `calm` has no events. */
export type SituationKind = 'calm' | 'rush' | 'cut' | 'lossy' | 'moving' | 'slow' | 'flood';

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
  /** Cables that only exist when the player builds them (chapter 7): how many, with a budget for about half of them */
  optional?: number;
  /** Zones (chapter 10): guests on the left, the office in the middle, servers on the right, and a firewall flows from the guests to the servers have to pass */
  zones?: boolean;
  /** How much narrower the middle of every shortest path is than the other roads, 0 to 0.8 (0: not at all) */
  trap?: number;
  title?: string;
  story?: string;
}

const SITUATION_NAMES: Record<SituationKind, string> = {
  calm: 'Quiet day',
  rush: 'Rush hour',
  cut: 'Cable cut',
  lossy: 'Bad weather',
  moving: 'On the move',
  slow: 'Congestion',
  flood: 'Under attack',
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

function place(spec: LevelSpec, random: Random): Point[] {
  return latticePoints(spec.family, spec.nodes, random);
}

/**
 * The pairs of node numbers to join: a connected network that obeys the drawing rules (no cable
 * over another or through a node, cables leave a node at an angle), or `undefined` when the
 * points do not allow one.
 */
function connect(points: readonly Point[], extra: number): [number, number][] | undefined {
  const count = points.length;
  const at = (n: number): Point => mapPoint(points[n] ?? { x: 0, y: 0 });
  const pairs: [number, number][] = [];
  for (let a = 0; a < count; a += 1) {
    for (let b = a + 1; b < count; b += 1) {
      pairs.push([a, b]);
    }
  }
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
  /** Whether the pair can be joined without breaking a drawing rule */
  const allowed = (pair: readonly [number, number]): boolean => {
    const from = at(pair[0]);
    const to = at(pair[1]);
    for (let other = 0; other < count; other += 1) {
      if (
        other !== pair[0] &&
        other !== pair[1] &&
        distanceToSegment(at(other), from, to) < EDGE_CLEARANCE
      ) {
        return false;
      }
    }
    for (const edge of edges) {
      const common = pair.find((node) => node === edge[0] || node === edge[1]);
      if (segmentsCross([from, to], [at(edge[0]), at(edge[1])], common !== undefined)) {
        return false;
      }
      if (common !== undefined) {
        const far = (pairOf: readonly [number, number]): number =>
          pairOf[0] === common ? pairOf[1] : pairOf[0];
        if (angleBetween(at(common), at(far(pair)), at(far(edge))) < MIN_ANGLE) {
          return false;
        }
      }
    }
    return true;
  };
  const add = (pair: [number, number]): void => {
    edges.push(pair);
    degree[pair[0]] = (degree[pair[0]] ?? 0) + 1;
    degree[pair[1]] = (degree[pair[1]] ?? 0) + 1;
    group[find(pair[0])] = find(pair[1]);
  };
  for (const pair of pairs) {
    if (find(pair[0]) !== find(pair[1]) && allowed(pair)) {
      add(pair);
    }
  }
  if (new Set(group.map((_, node) => find(node))).size > 1) {
    return undefined;
  }
  let added = 0;
  for (const pair of pairs) {
    if (added >= extra) {
      break;
    }
    const exists = edges.some((edge) => edge[0] === pair[0] && edge[1] === pair[1]);
    if (!exists && (degree[pair[0]] ?? 0) < 4 && (degree[pair[1]] ?? 0) < 4 && allowed(pair)) {
      add(pair);
      added += 1;
    }
  }
  return edges;
}

/** Places the nodes and joins them, trying again with new positions until the drawing rules hold. */
function layoutNetwork(
  spec: LevelSpec,
  random: Random,
): { points: Point[]; edges: [number, number][] } {
  const extra = Math.max(spec.family === 'ring' ? 1 : 0, Math.round(spec.extraLinks * spec.nodes));
  let points: Point[] = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    points = place(spec, random);
    const apart = points.every((one, at) =>
      points
        .slice(at + 1)
        .every((two) => distance(mapPoint(one), mapPoint(two)) >= NODE_MIN_DISTANCE),
    );
    const edges = apart ? connect(points, extra) : undefined;
    if (edges !== undefined) {
      return { points, edges };
    }
  }
  return { points, edges: [] };
}

function farthestPair(points: readonly Point[]): [number, number] {
  let best: [number, number] = [0, Math.min(1, points.length - 1)];
  let longest = -1;
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      const length = distance(
        mapPoint(points[a] ?? { x: 0, y: 0 }),
        mapPoint(points[b] ?? { x: 0, y: 0 }),
      );
      if (length > longest) {
        longest = length;
        best = [a, b];
      }
    }
  }
  return best;
}

function buildNetwork(spec: LevelSpec, random: Random): { nodes: NetNode[]; links: NetLink[] } {
  const { points, edges } = layoutNetwork(spec, random);
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
    const length = distance(
      mapPoint(points[a] ?? { x: 0, y: 0 }),
      mapPoint(points[b] ?? { x: 0, y: 0 }),
    );
    const core = (degree[a] ?? 0) >= 3 && (degree[b] ?? 0) >= 3;
    const capacity = 5 + random.int(6) + (core ? 3 : 0);
    return {
      id: `l${String(position)}`,
      a: `n${String(a)}`,
      b: `n${String(b)}`,
      capacity,
      delay: Math.min(4, Math.max(1, Math.round(length / 16))),
      loss: lossyPicks.has(position) ? (random.next() < 0.5 ? 0.1 : 0.2) : 0,
      // With queues some links have no buffer, some a small one and some a big one
      ...(spec.rules.queues ? { buffer: Math.ceil(capacity * random.pick([0, 0.4, 0.8])) } : {}),
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
      // Two flows of one kind are not alike: each sends between 0.6 and 1.5 times the usual
      demand: BASE_DEMAND[profile] * (0.6 + random.next() * 0.9),
    };
  });
  return flows;
}

/** How many different demands a level with this many flows shows: two flows differ, more than two have three. */
export function distinctDemandsWanted(flows: number): number {
  return Math.min(flows, flows <= 2 ? 2 : 3);
}

/**
 * Makes the demands differ: while fewer values occur than `distinctDemandsWanted` asks for, the
 * flows that share the most common value are moved apart: the heaviest kind of traffic sends a
 * little more, the next one a little less, then two more and two less, and so on (never to a value
 * that another flow sends, never below 1). So video and bulk stay big and voice and control small,
 * and the pressure on the network stays about the same.
 */
function spreadDemands(level: Level): Level {
  const demands = level.flows.map((flow) => Math.max(1, Math.round(flow.demand)));
  const weight = (position: number): number =>
    BASE_DEMAND[level.flows[position]?.profile ?? 'voice'];
  const wanted = distinctDemandsWanted(demands.length);
  for (let round = 0; round < 6 && new Set(demands).size < wanted; round += 1) {
    const counts = new Map<number, number[]>();
    for (const [position, value] of demands.entries()) {
      counts.set(value, [...(counts.get(value) ?? []), position]);
    }
    const crowd = [...counts.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    const ordered = [...crowd].sort((a, b) => weight(b) - weight(a) || b - a);
    const value = demands[ordered[0] ?? 0] ?? 1;
    const used = new Set(demands.filter((_, position) => !crowd.includes(position)));
    used.add(value);
    // The lightest of the crowd keeps the value, the others take the free values around it
    const around = [1, -1, 2, -2, 3, -3, 4, -4].map((offset) => value + offset);
    for (const position of ordered.slice(0, -1)) {
      const fresh = around.find((candidate) => candidate >= 1 && !used.has(candidate));
      if (fresh !== undefined) {
        demands[position] = fresh;
        used.add(fresh);
      }
    }
  }
  return {
    ...level,
    flows: level.flows.map((flow, position) => ({ ...flow, demand: demands[position] ?? 1 })),
  };
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
    case 'flood': {
      const servers = level.nodes.filter((node) => node.kind === 'server');
      const target = random.pick(servers.length > 0 ? servers : level.nodes);
      const attackers = level.nodes.filter(
        (node) =>
          node.id !== target.id &&
          node.kind !== 'firewall' &&
          (shortestPath(index, node.id, target.id)?.length ?? 0) >= 3,
      );
      const attacker = attackers.length > 0 ? random.pick(attackers) : undefined;
      if (attacker === undefined) {
        return [];
      }
      const probe = {
        kind: 'flood',
        source: attacker.id,
        target: target.id,
        from: 0,
        to: 1,
        rate: 1,
      } as const;
      const used = floodLinks(index, probe, () => true);
      const room = Math.min(...used.map((id) => index.linkById.get(id)?.capacity ?? 5));
      const rate = Math.max(2, Math.round(room * 0.7));
      return [{ ...probe, from: 2, to: Math.min(steps, 7), rate }];
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

/**
 * Makes some cables optional: they cost something and exist only when built. The network without
 * them must still connect every flow, and the budget pays for about half of them, so the player
 * has to choose.
 */
function markOptional(level: Level, count: number, random: Random): Level {
  if (count <= 0) {
    return level;
  }
  const chosen: string[] = [];
  const index = indexLevel(level);
  for (const link of random.shuffle(level.links)) {
    if (chosen.length >= count) {
      break;
    }
    const without = [...chosen, link.id];
    const connected = level.flows.every(
      (flow) =>
        shortestPath(index, flow.source, flow.target, (id) => !without.includes(id)) !== undefined,
    );
    if (connected) {
      chosen.push(link.id);
    }
  }
  const cost = (capacity: number): number => Math.max(2, Math.ceil(capacity / 2));
  const total = level.links
    .filter((link) => chosen.includes(link.id))
    .reduce((sum, link) => sum + cost(link.capacity), 0);
  return {
    ...level,
    links: level.links.map((link) =>
      chosen.includes(link.id) ? { ...link, optional: true, cost: cost(link.capacity) } : link,
    ),
    budget: Math.max(2, Math.floor(total * 0.55)),
  };
}

const ZONES: readonly Zone[] = [
  { id: 'guests', name: 'Guests' },
  { id: 'office', name: 'Office' },
  { id: 'servers', name: 'Servers' },
];

function zoneOf(node: Pick<NetNode, 'x'>): string {
  return node.x < 38 ? 'guests' : node.x < 66 ? 'office' : 'servers';
}

/**
 * Gives the nodes zones by where they stand, makes one node of the middle the firewall, and makes
 * the flows from the guests to the servers pass it.
 */
function applyZones(
  nodes: readonly NetNode[],
  links: readonly NetLink[],
  flows: readonly Flow[],
  random: Random,
): { nodes: NetNode[]; flows: Flow[] } {
  const degree = (id: string): number =>
    links.filter((link) => link.a === id || link.b === id).length;
  const candidates = nodes.filter(
    (node) => node.kind !== 'server' && zoneOf(node) === 'office' && degree(node.id) >= 2,
  );
  const wall = candidates.length > 0 ? random.pick(candidates) : undefined;
  const zoned: NetNode[] = nodes.map((node) => ({
    ...node,
    zone: zoneOf(node),
    ...(node.id === wall?.id ? { kind: 'firewall' as const } : {}),
  }));
  if (wall === undefined) {
    return { nodes: zoned, flows: [...flows] };
  }
  const inZone = (zone: string): NetNode[] =>
    zoned.filter((node) => node.zone === zone && node.id !== wall.id);
  const guarded = flows.map((flow) => {
    const from = zoned.find((node) => node.id === flow.source);
    const to = zoned.find((node) => node.id === flow.target);
    return from?.zone === 'guests' && to?.zone === 'servers' ? { ...flow, via: [wall.id] } : flow;
  });
  if (guarded.some((flow) => (flow.via ?? []).length > 0) || guarded.length === 0) {
    return { nodes: zoned, flows: guarded };
  }
  const guests = inZone('guests');
  const servers = inZone('servers');
  const first = guarded[0];
  if (first === undefined || guests.length === 0 || servers.length === 0) {
    return { nodes: zoned, flows: guarded };
  }
  const forced: Flow = {
    ...first,
    source: random.pick(guests).id,
    target: random.pick(servers).id,
    via: [wall.id],
  };
  return { nodes: zoned, flows: [forced, ...guarded.slice(1)] };
}

export function generateLevel(spec: LevelSpec): Level {
  const random = createRandom(spec.seed);
  const built = buildNetwork(spec, random);
  const zoned =
    spec.zones === true
      ? applyZones(built.nodes, built.links, buildFlows(spec, built.nodes, random), random)
      : undefined;
  const nodes = zoned?.nodes ?? built.nodes;
  const links = built.links;
  const base: Level = {
    id: `generated-${String(spec.seed)}`,
    title: spec.title ?? 'Generated level',
    story: spec.story ?? '',
    nodes,
    links,
    flows: zoned?.flows ?? buildFlows(spec, nodes, random),
    situations: [],
    rules: spec.rules,
    ...(zoned === undefined ? {} : { zones: ZONES }),
  };
  const scaled = markOptional(
    spreadDemands(scaleDemand(narrowShortcuts(base, spec.trap ?? 0), spec.pressure)),
    spec.optional ?? 0,
    random,
  );
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
