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
  /** An extra packet that redundancy sends (it can replace a lost one) */
  coded: boolean;
}

/** One packet is sent for every unit of traffic of a path in a minute (at least one, at most the cap). */
const PACKET_UNIT = 1;
const MOST_PACKETS = 12;
/** The minutes a packet needs for one unit of delay of a cable (a cable of delay 2 takes 0.3). */
export const MINUTES_PER_DELAY = 0.15;
/** The minutes a lost packet stays where it was lost, fading (about half a second of the stress test) */
const LOST_MINUTES = 0.45;
/** How many minutes back the packets that are still on their way can have left */
const MOST_BACK = 8;

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

/** The minutes a packet needs for a cable: its delay, longer while the cable is full (like the stress test). */
export function crossingMinutes(index: LevelIndex, result: StepResult, id: string): number {
  const delay = index.linkById.get(id)?.delay ?? 1;
  const load = Math.min(1, loadRatio(result.links[id]));
  return delay * (1 + load * load) * MINUTES_PER_DELAY;
}

/** A number between 0 and 1 that looks random but is the same for the same input (a packet always is lost in the same place). */
function unit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** The packet number `at` of `count` is dropped when the running count of a share steps up (an even spread). */
function dropsAt(at: number, share: number): boolean {
  return Math.floor((at + 1) * share + 1e-9) > Math.floor(at * share + 1e-9);
}

/** One packet that was sent in a step: when it left (in minutes), how long it needs and where it is lost. */
interface Sent {
  key: string;
  flow: string;
  leaves: number;
  duration: number;
  points: readonly Point[];
  /** The moment each node of the way is reached, as a share of the whole time */
  reached: readonly number[];
  /** Where it is lost, as a share of its time (1: it arrives) */
  endsAt: number;
  coded: boolean;
}

/** The point of a packet at a share of its time: it crosses every cable in the time that cable takes. */
function pointAt(points: readonly Point[], reached: readonly number[], progress: number): Point {
  for (let at = 1; at < points.length; at += 1) {
    const to = reached[at] ?? 1;
    if (progress <= to || at === points.length - 1) {
      const from = reached[at - 1] ?? 0;
      const a = points[at - 1] ?? { x: 0, y: 0 };
      const b = points[at] ?? a;
      const share = to === from ? 1 : Math.min(1, Math.max(0, (progress - from) / (to - from)));
      return { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share };
    }
  }
  return points[0] ?? { x: 0, y: 0 };
}

/**
 * The packets that a step sent and that are on their way at `now`: for every path an even rhythm
 * of packets, as many as its traffic says (the extra coded ones of redundancy included). A packet
 * crosses every cable in the time the cable takes, so on a long route more packets are under way
 * at once, and the gaps between them are the same.
 */
function sentIn(
  index: LevelIndex,
  situation: Situation,
  steps: readonly StepResult[],
  step: number,
  at: number,
  now: number,
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
      const times = path.links.map((id) => crossingMinutes(index, result, id));
      const duration = Math.max(
        times.reduce((sum, value) => sum + value, 0),
        1e-9,
      );
      const reached = [0];
      for (const time of times) {
        reached.push((reached[reached.length - 1] ?? 0) + time / duration);
      }
      const total = Math.max(
        1,
        Math.min(
          MOST_PACKETS,
          Math.round((flowResult.sent * path.share * (1 + flowResult.redundancy)) / PACKET_UNIT),
        ),
      );
      const plain = Math.round(total / (1 + flowResult.redundancy));
      // Why packets are lost: a cable that loses some of them, or a cable that is over full
      const survives = path.links.reduce(
        (share, id) => share * (1 - lossOf(index, situation, step, id)),
        1,
      );
      const lossy = path.links.findIndex((id) => lossOf(index, situation, step, id) > 0);
      const bad = path.links.findIndex((id) => loadRatio(result.links[id]) > 1 + 1e-9);
      // Where on its cable a packet is lost is chosen for every packet, between a tenth and nine
      // tenths of the way along it (so never at the start or at the end of the cable)
      const spot = (link: number, number: number): number => {
        const from = reached[link] ?? 0;
        const to = reached[link + 1] ?? 1;
        return from + (to - from) * (0.1 + 0.8 * unit(number));
      };
      for (let packet = 0; packet < total; packet += 1) {
        const leaves = at + packet / total;
        const progress = (now - leaves) / duration;
        const number = Math.round(at * total) + packet;
        const lostToLoss = lossy >= 0 && dropsAt(number, 1 - survives);
        const lostToLoad = dropsAt(number + 3, 1 - path.kept);
        const lossAt = lossy < 0 ? 1 : spot(lossy, number);
        const overAt = bad < 0 ? 0.6 : spot(bad, number + 1);
        const endsAt = lostToLoss
          ? Math.min(lossAt, lostToLoad ? overAt : 1)
          : lostToLoad
            ? overAt
            : 1;
        // A packet that is lost stays where it was lost for a moment, fading
        const visibleUntil = endsAt < 1 ? endsAt + LOST_MINUTES / duration : 1;
        if (progress < 0 || progress >= visibleUntil) {
          continue;
        }
        sent.push({
          key: `${flow.id}:${String(pathAt)}:${String(at)}:${String(packet)}`,
          flow: flow.id,
          leaves,
          duration,
          points,
          reached,
          endsAt,
          coded: packet >= plain,
        });
      }
    });
  }
  return sent;
}

/**
 * The packets on the map at a moment `time` (0 to 1) inside a step. Every step sends its packets
 * one after the other, and a packet needs as long as the delay of its route says (a long route
 * takes more than a minute), so the packets of several minutes can be under way at once and when
 * a burst is over its packets still arrive: nothing vanishes at the end of a step. The packets
 * before the first step are those of the first (a network at work, not one that starts empty). A
 * packet that is lost fades where it is lost, a little bigger.
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
  for (let back = 0; back <= MOST_BACK; back += 1) {
    const at = step - back;
    for (const one of sentIn(index, situation, steps, Math.max(0, at), at, now)) {
      const progress = (now - one.leaves) / one.duration;
      // Minutes since the packet was lost (0 while it is still on its way)
      const after = one.endsAt < 1 ? Math.max(0, (progress - one.endsAt) * one.duration) : 0;
      const fade = Math.min(1, after / LOST_MINUTES);
      packets.push({
        key: one.key,
        flow: one.flow,
        point: pointAt(one.points, one.reached, Math.min(progress, one.endsAt)),
        opacity: 1 - fade,
        scale: 1 + fade * 0.9,
        dropped: after > 0,
        coded: one.coded,
      });
    }
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
