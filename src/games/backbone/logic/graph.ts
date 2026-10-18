import type { Flow, Level, NetLink, NodePath } from './types';

/** A level prepared for fast lookups. Build it once with `indexLevel`, then pass it around. */
export interface LevelIndex {
  level: Level;
  /** Link ids in the order of `level.links` */
  linkIds: readonly string[];
  linkById: ReadonlyMap<string, NetLink>;
  /** For a node: its neighbours and the link that leads there */
  neighbours: ReadonlyMap<string, readonly { node: string; link: string }[]>;
}

export function indexLevel(level: Level): LevelIndex {
  const linkById = new Map<string, NetLink>();
  const neighbours = new Map<string, { node: string; link: string }[]>();
  for (const node of level.nodes) {
    neighbours.set(node.id, []);
  }
  for (const link of level.links) {
    linkById.set(link.id, link);
    neighbours.get(link.a)?.push({ node: link.b, link: link.id });
    neighbours.get(link.b)?.push({ node: link.a, link: link.id });
  }
  return { level, linkIds: level.links.map((link) => link.id), linkById, neighbours };
}

/**
 * The links a path uses, in order, or `undefined` when it is not a path of this network: it has to
 * start and end at different nodes, use only existing links and never visit a node twice.
 */
export function linksOfPath(index: LevelIndex, path: NodePath): string[] | undefined {
  if (path.length < 2 || new Set(path).size !== path.length) {
    return undefined;
  }
  const links: string[] = [];
  for (let position = 1; position < path.length; position += 1) {
    const from = path[position - 1];
    const to = path[position];
    const step = index.neighbours.get(from ?? '')?.find((entry) => entry.node === to);
    if (step === undefined) {
      return undefined;
    }
    links.push(step.link);
  }
  return links;
}

/** Fastest path by delay (Dijkstra, ties by the order of the node ids), or `undefined`. */
export function shortestPath(
  index: LevelIndex,
  source: string,
  target: string,
  isUsable: (link: string) => boolean = () => true,
): NodePath | undefined {
  const distance = new Map<string, number>([[source, 0]]);
  const previous = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let current: string | undefined;
    let best = Infinity;
    for (const [node, value] of distance) {
      if (!done.has(node) && (value < best || (value === best && node < (current ?? '')))) {
        best = value;
        current = node;
      }
    }
    if (current === undefined) {
      return undefined;
    }
    if (current === target) {
      break;
    }
    done.add(current);
    for (const step of index.neighbours.get(current) ?? []) {
      const link = index.linkById.get(step.link);
      if (link === undefined || done.has(step.node) || !isUsable(step.link)) {
        continue;
      }
      const candidate = best + link.delay;
      if (candidate < (distance.get(step.node) ?? Infinity)) {
        distance.set(step.node, candidate);
        previous.set(step.node, current);
      }
    }
  }
  const path = [target];
  let node = target;
  while (node !== source) {
    const before = previous.get(node);
    if (before === undefined) {
      return undefined;
    }
    path.push(before);
    node = before;
  }
  return path.reverse();
}

/** The total delay of a path with no load on it. */
export function pathDelay(index: LevelIndex, path: NodePath): number | undefined {
  const links = linksOfPath(index, path);
  if (links === undefined) {
    return undefined;
  }
  return links.reduce((sum, id) => sum + (index.linkById.get(id)?.delay ?? 0), 0);
}

/**
 * The simple paths from `source` to `target`, fastest first (ties: fewer hops, then by node ids),
 * at most `limit` of them and at most `maxHops` links long.
 */
export function candidatePaths(
  index: LevelIndex,
  source: string,
  target: string,
  limit: number,
  maxHops = 7,
  via: readonly string[] = [],
): NodePath[] {
  const found: { path: string[]; delay: number }[] = [];
  const visited = new Set<string>();
  const stack: string[] = [source];
  const walk = (node: string, delay: number): void => {
    if (node === target) {
      if (via.every((required) => stack.includes(required))) {
        found.push({ path: [...stack], delay });
      }
      return;
    }
    if (stack.length > maxHops) {
      return;
    }
    visited.add(node);
    for (const step of index.neighbours.get(node) ?? []) {
      if (visited.has(step.node)) {
        continue;
      }
      stack.push(step.node);
      walk(step.node, delay + (index.linkById.get(step.link)?.delay ?? 0));
      stack.pop();
    }
    visited.delete(node);
  };
  walk(source, 0);
  found.sort(
    (x, y) =>
      x.delay - y.delay ||
      x.path.length - y.path.length ||
      x.path.join().localeCompare(y.path.join()),
  );
  return found.slice(0, limit).map((entry) => entry.path);
}

/** The paths a flow may take: the fastest simple paths that pass every node the flow has to pass. */
export function routesOf(index: LevelIndex, flow: Flow, limit: number): NodePath[] {
  const via = flow.via ?? [];
  return candidatePaths(index, flow.source, flow.target, limit, via.length > 0 ? 9 : 7, via);
}

/** The fastest path of a flow that obeys its policy. */
export function fastestRoute(index: LevelIndex, flow: Flow): NodePath | undefined {
  return (flow.via ?? []).length === 0
    ? shortestPath(index, flow.source, flow.target)
    : routesOf(index, flow, 1)[0];
}
