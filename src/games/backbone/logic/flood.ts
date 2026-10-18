import { type LevelIndex, linksOfPath, shortestPath } from './graph';
import type { NetEvent } from './types';

/**
 * A flood (chapter 12): useless traffic from one node to another, which nobody can route. It goes
 * along the fastest path that is still whole and fills the cables and queues on the way, in the
 * middle queue class. A firewall on its way stops it: the cables behind the first firewall do not
 * see it. The player cannot change its route, only keep their own traffic out of its way (or put it
 * in a class that is served before it).
 */

type Flood = Extract<NetEvent, { kind: 'flood' }>;

/** The cables the flood uses in a step, given which cables are whole. */
export function floodLinks(
  index: LevelIndex,
  event: Flood,
  isUp: (link: string) => boolean,
): readonly string[] {
  const path = shortestPath(index, event.source, event.target, isUp);
  if (path === undefined) {
    return [];
  }
  const links = linksOfPath(index, path) ?? [];
  const kinds = new Map(index.level.nodes.map((node) => [node.id, node.kind]));
  // The first firewall after the attacker ends the flood: it uses the cables up to that node
  const stop = path.findIndex((node, at) => at > 0 && kinds.get(node) === 'firewall');
  return stop < 0 ? links : links.slice(0, stop);
}

/** How much attack traffic every cable carries in a step. */
export function floodLoads(
  index: LevelIndex,
  events: readonly NetEvent[],
  step: number,
  isUp: (link: string) => boolean,
): Map<string, number> {
  const loads = new Map<string, number>();
  for (const event of events) {
    if (event.kind === 'flood' && step >= event.from && step < event.to) {
      for (const link of floodLinks(index, event, isUp)) {
        loads.set(link, (loads.get(link) ?? 0) + event.rate);
      }
    }
  }
  return loads;
}
