import { candidatePaths, indexLevel, type LevelIndex, linksOfPath, shortestPath } from './graph';
import { singlePath } from './plan';
import { profiles } from './profiles';
import type { Level, NodePath, Plan } from './types';

/**
 * The two simple strategies the player is measured against, as in the master thesis.
 *
 * Both are deliberately plain: one path per flow, no redundancy, no backup, no holding back. They
 * know the network as it is on a calm day and nothing about failures, loss or priorities.
 */

/** Shortest path: every flow takes the fastest path through the network. */
export function shortestPathPlan(level: Level | LevelIndex): Plan {
  const index = 'linkById' in level ? level : indexLevel(level);
  const plan: Record<string, ReturnType<typeof singlePath>> = {};
  for (const flow of index.level.flows) {
    const path = shortestPath(index, flow.source, flow.target);
    if (path !== undefined) {
      plan[flow.id] = singlePath(path);
    }
  }
  return plan;
}

/** How many paths the load balanced strategy looks at for every flow. */
const BALANCE_CANDIDATES = 8;

/**
 * Load balanced: the flows one after the other, the most valuable first, each on the path whose
 * busiest link would be the least busy (load divided by capacity). Ties go to the faster path.
 */
export function loadBalancedPlan(level: Level | LevelIndex): Plan {
  const index = 'linkById' in level ? level : indexLevel(level);
  const load = new Map<string, number>();
  const plan: Record<string, ReturnType<typeof singlePath>> = {};
  const order = [...index.level.flows].sort(
    (x, y) =>
      profiles[y.profile].weight * y.demand - profiles[x.profile].weight * x.demand ||
      x.id.localeCompare(y.id),
  );
  for (const flow of order) {
    let best: NodePath | undefined;
    let bestBusiest = Infinity;
    for (const path of candidatePaths(index, flow.source, flow.target, BALANCE_CANDIDATES)) {
      const links = linksOfPath(index, path) ?? [];
      const busiest = Math.max(
        ...links.map(
          (id) => ((load.get(id) ?? 0) + flow.demand) / (index.linkById.get(id)?.capacity ?? 1),
        ),
      );
      if (busiest < bestBusiest - 1e-9) {
        bestBusiest = busiest;
        best = path;
      }
    }
    if (best !== undefined) {
      for (const id of linksOfPath(index, best) ?? []) {
        load.set(id, (load.get(id) ?? 0) + flow.demand);
      }
      plan[flow.id] = singlePath(best);
    }
  }
  return plan;
}
