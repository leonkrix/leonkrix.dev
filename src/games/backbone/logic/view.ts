import { mapPoint, type Point } from './geometry';
import type { LevelIndex } from './graph';
import type { Level, LinkStepResult, NetNode, Situation, StepResult } from './types';

/**
 * What the drawing needs, worked out from the level and the results: where things are, how full a
 * link is, where the packets are. Pure functions, so the drawing is simple and this is tested.
 */

export { MAP_HEIGHT, MAP_WIDTH, type Point } from './geometry';

export function pointOf(node: NetNode): Point {
  return mapPoint(node);
}

/** How full a link is: the traffic that wants it divided by what it can carry (infinity when it carries nothing). */
export function loadRatio(
  result: Pick<LinkStepResult, 'offered' | 'capacity'> | undefined,
): number {
  if (result === undefined || result.offered <= 0) {
    return 0;
  }
  return result.capacity > 0 ? result.offered / result.capacity : Infinity;
}

/**
 * Load in four classes. The drawing uses a color and, for the last class, a dashed line too, and
 * the number is always written, so the class is never the only signal.
 */
export type LoadClass = 'idle' | 'ok' | 'busy' | 'over';

export function loadClass(ratio: number): LoadClass {
  if (ratio <= 0) {
    return 'idle';
  }
  if (ratio <= 0.7) {
    return 'ok';
  }
  return ratio <= 1 + 1e-9 ? 'busy' : 'over';
}

/** The points of a path along the nodes. */
export function polyline(index: LevelIndex, nodes: readonly string[]): Point[] {
  return nodes.flatMap((id) => {
    const node = index.level.nodes.find((entry) => entry.id === id);
    return node === undefined ? [] : [pointOf(node)];
  });
}

/** The nodes a path passes, from the links it uses, starting at `from`. */
export function nodesOfLinks(index: LevelIndex, from: string, links: readonly string[]): string[] {
  const nodes = [from];
  let current = from;
  for (const id of links) {
    const link = index.linkById.get(id);
    if (link === undefined) {
      break;
    }
    current = link.a === current ? link.b : link.a;
    nodes.push(current);
  }
  return nodes;
}

function length(points: readonly Point[]): number {
  let total = 0;
  for (let at = 1; at < points.length; at += 1) {
    const a = points[at - 1];
    const b = points[at];
    if (a !== undefined && b !== undefined) {
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return total;
}

/** The point at a fraction (0 to 1) of the way along a polyline. */
export function along(points: readonly Point[], fraction: number): Point {
  const first = points[0] ?? { x: 0, y: 0 };
  const total = length(points);
  if (total === 0) {
    return first;
  }
  let remaining = Math.min(1, Math.max(0, fraction)) * total;
  for (let at = 1; at < points.length; at += 1) {
    const a = points[at - 1];
    const b = points[at];
    if (a === undefined || b === undefined) {
      continue;
    }
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segment || at === points.length - 1) {
      const share = segment === 0 ? 0 : Math.min(1, remaining / segment);
      return { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share };
    }
    remaining -= segment;
  }
  return points[points.length - 1] ?? first;
}

export interface Packet {
  key: string;
  flow: string;
  point: Point;
  /** 1 while it travels; falls to 0 as a dropped packet reaches the place where it is lost */
  opacity: number;
  /** 1 while it travels; a lost packet swells a little as it fades */
  scale: number;
  dropped: boolean;
}

const PACKET_UNIT = 2;
const MOST_PACKETS = 6;

/** How much of its traffic a cable loses in a step of a situation (0 to 1): its own loss and an event. */
function lossOf(index: LevelIndex, situation: Situation, step: number, link: string): number {
  let keep = 1 - (index.linkById.get(link)?.loss ?? 0);
  for (const event of situation.events) {
    if (event.kind === 'lossy' && event.link === link && step >= event.from && step < event.to) {
      keep *= 1 - event.loss;
    }
  }
  return 1 - keep;
}

/** One packet that was sent in a step: when it left (in steps), the way it takes and where it is lost. */
interface Sent {
  key: string;
  flow: string;
  leaves: number;
  points: readonly Point[];
  /** Where it is lost, as a share of its way (1: it arrives) */
  endsAt: number;
}

/** The packets that a step sends: a few for every path, spread over the step. */
function sentIn(
  index: LevelIndex,
  situation: Situation,
  steps: readonly StepResult[],
  step: number,
  at: number,
): Sent[] {
  const result = steps[step];
  if (result === undefined) {
    return [];
  }
  const sent: Sent[] = [];
  for (const flow of index.level.flows) {
    const flowResult = result.flows[flow.id];
    if (flowResult === undefined) {
      continue;
    }
    flowResult.paths.forEach((path, pathAt) => {
      const nodes = nodesOfLinks(index, flow.source, path.links);
      const points = polyline(index, nodes);
      const total = Math.max(length(points), 1e-9);
      const count = Math.max(
        1,
        Math.min(MOST_PACKETS, Math.round((flowResult.sent * path.share) / PACKET_UNIT)),
      );
      const keep = Math.round(
        count *
          Math.min(1, flowResult.delivered / Math.max(path.share, 1e-9)) *
          (path.share > 0 ? 1 : 0),
      );
      // Why packets are lost: a cable that loses some of them, or a cable that is over full
      const survives = path.links.reduce(
        (share, id) => share * (1 - lossOf(index, situation, step, id)),
        1,
      );
      const lossy = path.links.findIndex((id) => lossOf(index, situation, step, id) > 0);
      const lostToLoss = lossy < 0 ? 0 : Math.min(count - keep, Math.round(count * (1 - survives)));
      const bad = path.links.findIndex((id) => loadRatio(result.links[id]) > 1 + 1e-9);
      const overAt = bad >= 0 ? length(polyline(index, nodes.slice(0, bad + 2))) / total : 0.6;
      const lossAt =
        lossy >= 0
          ? (length(polyline(index, nodes.slice(0, lossy + 1))) +
              length(polyline(index, nodes.slice(lossy, lossy + 2))) / 2) /
            total
          : overAt;
      for (let packet = 0; packet < count; packet += 1) {
        const dropped = packet >= keep;
        sent.push({
          key: `${flow.id}:${String(pathAt)}:${String(at)}:${String(packet)}`,
          flow: flow.id,
          leaves: at + packet / count,
          points,
          endsAt: !dropped ? 1 : packet - keep < lostToLoss ? lossAt : overAt,
        });
      }
    });
  }
  return sent;
}

/**
 * The packets on the map at a moment `time` (0 to 1) inside a step. A step sends its packets one
 * after the other, and every packet needs one step for its way. So when a burst is over the
 * packets it sent are still on their way and arrive: nothing vanishes at the end of a step. The
 * packets of the step before the first are those of the first (a network at work, not one that
 * starts empty). A packet that is lost fades where it is lost, a little bigger.
 */
export function packetsAt(
  index: LevelIndex,
  situation: Situation,
  steps: readonly StepResult[],
  step: number,
  time: number,
): Packet[] {
  const now = step + time;
  const packets: Packet[] = [];
  const sent = [
    ...sentIn(index, situation, steps, Math.max(0, step - 1), step - 1),
    ...sentIn(index, situation, steps, step, step),
  ];
  for (const one of sent) {
    const progress = now - one.leaves;
    if (progress < 0 || progress >= 1) {
      continue;
    }
    const dropped = one.endsAt < 1;
    if (dropped && progress > one.endsAt) {
      continue;
    }
    const fade = dropped ? Math.max(0, progress - (one.endsAt - 0.12)) / 0.12 : 0;
    packets.push({
      key: one.key,
      flow: one.flow,
      point: along(one.points, progress),
      opacity: 1 - fade,
      scale: 1 + fade * 0.7,
      dropped,
    });
  }
  return packets;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

const VECTORS: Record<Direction, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

/**
 * The node an arrow key moves to: of the neighbours of the node, the one that lies most in that
 * direction; if none lies in it, of all nodes the one that does. `undefined` when nothing does.
 */
export function nodeInDirection(
  index: LevelIndex,
  from: string,
  direction: Direction,
): string | undefined {
  const origin = index.level.nodes.find((node) => node.id === from);
  if (origin === undefined) {
    return undefined;
  }
  const here = pointOf(origin);
  const vector = VECTORS[direction];
  const score = (node: NetNode): number => {
    const there = pointOf(node);
    const dx = there.x - here.x;
    const dy = there.y - here.y;
    const distance = Math.hypot(dx, dy);
    const aligned = (dx * vector.x + dy * vector.y) / (distance || 1);
    return aligned < 0.35 ? -Infinity : aligned * 3 - distance / 40;
  };
  const neighbourIds = new Set((index.neighbours.get(from) ?? []).map((entry) => entry.node));
  const best = (nodes: readonly NetNode[]): string | undefined => {
    let winner: NetNode | undefined;
    let top = -Infinity;
    for (const node of nodes) {
      const value = score(node);
      if (value > top) {
        top = value;
        winner = node;
      }
    }
    return winner?.id;
  };
  return (
    best(index.level.nodes.filter((node) => neighbourIds.has(node.id))) ??
    best(index.level.nodes.filter((node) => node.id !== from))
  );
}

/** Which links two nodes are joined by, in either direction, or `undefined`. */
export function linkBetween(level: Level, a: string, b: string): string | undefined {
  return level.links.find(
    (link) => (link.a === a && link.b === b) || (link.a === b && link.b === a),
  )?.id;
}

/** Where the stress test is: the situation, the step in it and how far inside the step (0 to 1). */
export interface Clock {
  situation: number;
  step: number;
  time: number;
}

/**
 * Moves the clock on by `fraction` of a step. It runs through the steps of a situation and then on
 * into the next situation; at the end of the last one it stops on the last step and says so.
 */
export function advanceClock(
  stepsOf: readonly number[],
  clock: Clock,
  fraction: number,
): { clock: Clock; finished: boolean } {
  let { situation, step, time } = clock;
  time += fraction;
  while (time >= 1) {
    time -= 1;
    const steps = stepsOf[situation] ?? 1;
    if (step + 1 < steps) {
      step += 1;
    } else if (situation + 1 < stepsOf.length) {
      situation += 1;
      step = 0;
    } else {
      return { clock: { situation, step, time: 0 }, finished: true };
    }
  }
  return { clock: { situation, step, time }, finished: false };
}
