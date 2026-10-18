import type { Level, NetNode } from './types';

/**
 * The drawing rules of a level. The map is 100 wide and 80 high, one unit is the same on both
 * axes. A level whose drawing breaks one of these rules is rejected: every cable must be seen
 * from end to end, every node must have room around it, and no cable may pass through a node or
 * over another cable.
 */

export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 80;

/** The y of a node is given from 0 to 100 and squeezed to the height of the map. */
export function mapPoint(node: Pick<NetNode, 'x' | 'y'>): Point {
  return { x: node.x, y: Math.round(node.y * (MAP_HEIGHT / 100) * 10) / 10 };
}

export interface Point {
  x: number;
  y: number;
}

/** Nodes are at least this far apart (units of the map; a node is about 8 wide) */
export const NODE_MIN_DISTANCE = 17;
/** A cable keeps at least this distance from every node it does not join */
export const EDGE_CLEARANCE = 7.5;
/** Two cables at a node are at least this many degrees apart */
export const MIN_ANGLE = 24;

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function orientation(a: Point, b: Point, c: Point): number {
  return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
}

/** Whether two segments cross each other (segments that only share an end point do not). */
export function segmentsCross(
  a: readonly [Point, Point],
  b: readonly [Point, Point],
  shared: boolean,
): boolean {
  if (shared) {
    return false;
  }
  const [p1, p2] = a;
  const [p3, p4] = b;
  return (
    orientation(p1, p3, p4) * orientation(p2, p3, p4) < 0 &&
    orientation(p1, p2, p3) * orientation(p1, p2, p4) < 0
  );
}

/** The distance from a point to a segment. */
export function distanceToSegment(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distance(point, from);
  }
  const along = Math.max(
    0,
    Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared),
  );
  return distance(point, { x: from.x + dx * along, y: from.y + dy * along });
}

/** The angle between two directions that start at the same point, in degrees (0 to 180). */
export function angleBetween(origin: Point, a: Point, b: Point): number {
  const first = Math.atan2(a.y - origin.y, a.x - origin.x);
  const second = Math.atan2(b.y - origin.y, b.x - origin.x);
  let difference = Math.abs(first - second);
  if (difference > Math.PI) {
    difference = 2 * Math.PI - difference;
  }
  return (difference * 180) / Math.PI;
}

/** What is wrong with the drawing of a level, in words. */
export function geometryProblems(level: Level): string[] {
  const problems: string[] = [];
  const at = new Map(level.nodes.map((node) => [node.id, mapPoint(node)]));
  const point = (id: string): Point => at.get(id) ?? { x: 0, y: 0 };

  for (let first = 0; first < level.nodes.length; first += 1) {
    for (let second = first + 1; second < level.nodes.length; second += 1) {
      const a = level.nodes[first];
      const b = level.nodes[second];
      if (
        a !== undefined &&
        b !== undefined &&
        distance(point(a.id), point(b.id)) < NODE_MIN_DISTANCE
      ) {
        problems.push(`${a.id} and ${b.id} are too close`);
      }
    }
  }
  for (const link of level.links) {
    const a = point(link.a);
    const b = point(link.b);
    for (const node of level.nodes) {
      if (node.id !== link.a && node.id !== link.b) {
        if (distanceToSegment(point(node.id), a, b) < EDGE_CLEARANCE) {
          problems.push(`${link.id} runs too close to ${node.id}`);
        }
      }
    }
  }
  for (let first = 0; first < level.links.length; first += 1) {
    for (let second = first + 1; second < level.links.length; second += 1) {
      const one = level.links[first];
      const two = level.links[second];
      if (one === undefined || two === undefined) {
        continue;
      }
      const common = [one.a, one.b].find((node) => node === two.a || node === two.b);
      if (
        segmentsCross(
          [point(one.a), point(one.b)],
          [point(two.a), point(two.b)],
          common !== undefined,
        )
      ) {
        problems.push(`${one.id} crosses ${two.id}`);
      }
      if (common !== undefined) {
        const far = (link: typeof one): string => (link.a === common ? link.b : link.a);
        if (angleBetween(point(common), point(far(one)), point(far(two))) < MIN_ANGLE) {
          problems.push(`${one.id} and ${two.id} leave ${common} too close together`);
        }
      }
    }
  }
  return problems;
}
