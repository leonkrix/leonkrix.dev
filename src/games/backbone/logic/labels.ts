import { distanceToSegment, MAP_HEIGHT, MAP_WIDTH, mapPoint, type Point } from './geometry';
import type { Level } from './types';

/**
 * Where the names of the nodes (and the "from" and "to" marks) go, so that nothing lies on a
 * cable, on another node or on another label. Sizes are estimates in the units of the map for a
 * map about 590 pixels wide, which is the width where the labels are shown at all.
 */

export type Side =
  | 'below'
  | 'above'
  | 'right'
  | 'left'
  | 'below-right'
  | 'below-left'
  | 'above-right'
  | 'above-left';

const SIDES: readonly Side[] = [
  'below',
  'above',
  'right',
  'left',
  'below-right',
  'below-left',
  'above-right',
  'above-left',
];

/** How far a label in a corner starts from the middle of its node, sideways */
const CORNER_OFFSET = 2.2;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_SIZE = 8;
const GAP = 0.9;
const LABEL_HEIGHT = 2.3;
const CHARACTER_WIDTH = 0.88;
const TAG_WIDTH = 4.6;
const LINK_LABEL: Readonly<{ width: number; height: number }> = { width: 7.4, height: 2.5 };

function boxAt(center: Point, width: number, height: number): Box {
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

/** The box of a label of the given size on one side of a node. */
function labelBox(node: Point, side: Side, width: number, height: number): Box {
  const reach = NODE_SIZE / 2 + GAP;
  switch (side) {
    case 'below':
      return boxAt({ x: node.x, y: node.y + reach + height / 2 }, width, height);
    case 'above':
      return boxAt({ x: node.x, y: node.y - reach - height / 2 }, width, height);
    case 'right':
      return boxAt({ x: node.x + reach + width / 2, y: node.y }, width, height);
    case 'left':
      return boxAt({ x: node.x - reach - width / 2, y: node.y }, width, height);
    case 'below-right':
      return boxAt(
        { x: node.x + CORNER_OFFSET + width / 2, y: node.y + NODE_SIZE / 2 + 0.6 + height / 2 },
        width,
        height,
      );
    case 'below-left':
      return boxAt(
        { x: node.x - CORNER_OFFSET - width / 2, y: node.y + NODE_SIZE / 2 + 0.6 + height / 2 },
        width,
        height,
      );
    case 'above-right':
      return boxAt(
        { x: node.x + CORNER_OFFSET + width / 2, y: node.y - NODE_SIZE / 2 - 0.6 - height / 2 },
        width,
        height,
      );
    case 'above-left':
      return boxAt(
        { x: node.x - CORNER_OFFSET - width / 2, y: node.y - NODE_SIZE / 2 - 0.6 - height / 2 },
        width,
        height,
      );
  }
}

function boxesOverlap(a: Box, b: Box, margin = 0.2): boolean {
  return (
    a.x < b.x + b.width + margin &&
    b.x < a.x + a.width + margin &&
    a.y < b.y + b.height + margin &&
    b.y < a.y + a.height + margin
  );
}

/** Whether a segment passes through a box (or comes closer to it than `margin`). */
function segmentHitsBox(from: Point, to: Point, box: Box, margin = 0.5): boolean {
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (distanceToSegment(center, from, to) <= Math.min(box.width, box.height) / 2 + margin) {
    return true;
  }
  // Sample along the segment: boxes are small, so a fine sampling finds every hit
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.5);
  for (let step = 0; step <= steps; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / Math.max(steps, 1);
    const y = from.y + ((to.y - from.y) * step) / Math.max(steps, 1);
    if (
      x > box.x - margin &&
      x < box.x + box.width + margin &&
      y > box.y - margin &&
      y < box.y + box.height + margin
    ) {
      return true;
    }
  }
  return false;
}

interface Scene {
  nodes: Map<string, Point>;
  segments: { id: string; from: Point; to: Point }[];
  linkLabels: Box[];
}

function sceneOf(level: Level): Scene {
  const nodes = new Map(level.nodes.map((node) => [node.id, mapPoint(node)]));
  const segments = level.links.flatMap((link) => {
    const from = nodes.get(link.a);
    const to = nodes.get(link.b);
    return from === undefined || to === undefined ? [] : [{ id: link.id, from, to }];
  });
  const linkLabels = segments.map((segment) =>
    boxAt(
      { x: (segment.from.x + segment.to.x) / 2, y: (segment.from.y + segment.to.y) / 2 },
      LINK_LABEL.width,
      LINK_LABEL.height,
    ),
  );
  return { nodes, segments, linkLabels };
}

/** How badly a label box collides with the rest of the drawing (0 is perfect). */
function cost(scene: Scene, owner: string, box: Box, placed: readonly Box[]): number {
  let total = 0;
  if (box.x < 0 || box.y < 0 || box.x + box.width > MAP_WIDTH || box.y + box.height > MAP_HEIGHT) {
    total += 200;
  }
  for (const [id, point] of scene.nodes) {
    if (id !== owner && boxesOverlap(box, boxAt(point, NODE_SIZE, NODE_SIZE), 0.4)) {
      total += 100;
    }
  }
  for (const other of placed) {
    if (boxesOverlap(box, other)) {
      total += 100;
    }
  }
  for (const other of scene.linkLabels) {
    if (boxesOverlap(box, other)) {
      total += 60;
    }
  }
  for (const segment of scene.segments) {
    if (segmentHitsBox(segment.from, segment.to, box)) {
      total += 50;
    }
  }
  return total;
}

export interface Placement {
  /** The side of every node where its name goes */
  names: ReadonlyMap<string, Side>;
  /** What is still colliding, summed over all labels (0 means nothing is) */
  conflicts: number;
}

function nameBox(scene: Scene, level: Level, id: string, side: Side): Box {
  const node = level.nodes.find((entry) => entry.id === id);
  const point = scene.nodes.get(id) ?? { x: 0, y: 0 };
  const width = Math.max(4, (node?.name.length ?? 4) * CHARACTER_WIDTH + 1.2);
  return labelBox(point, side, width, LABEL_HEIGHT);
}

/** Chooses a side for the name of every node: the one with the fewest collisions, below first. */
export function placeNames(level: Level): Placement {
  const scene = sceneOf(level);
  const chosen = new Map<string, Side>();
  const order = [...level.nodes].sort((a, b) => a.id.localeCompare(b.id));
  // Two rounds: the second one looks at the sides the others took in the first
  for (let round = 0; round < 3; round += 1) {
    for (const node of order) {
      const others = [...chosen]
        .filter(([id]) => id !== node.id)
        .map(([id, side]) => nameBox(scene, level, id, side));
      let best: Side = 'below';
      let lowest = Infinity;
      for (const side of SIDES) {
        const value = cost(scene, node.id, nameBox(scene, level, node.id, side), others);
        if (value < lowest) {
          lowest = value;
          best = side;
        }
      }
      chosen.set(node.id, best);
    }
  }
  let conflicts = 0;
  for (const node of level.nodes) {
    const others = [...chosen]
      .filter(([id]) => id !== node.id)
      .map(([id, side]) => nameBox(scene, level, id, side));
    conflicts += cost(
      scene,
      node.id,
      nameBox(scene, level, node.id, chosen.get(node.id) ?? 'below'),
      others,
    );
  }
  return { names: chosen, conflicts };
}

/** The side for the "from" or "to" mark of a node: free of cables and not where the name is. */
export function placeTag(level: Level, placement: Placement, id: string): Side {
  const scene = sceneOf(level);
  const point = scene.nodes.get(id) ?? { x: 0, y: 0 };
  const nameSide = placement.names.get(id);
  const names = [...placement.names]
    .filter(([other]) => other !== id)
    .map(([other, side]) => nameBox(scene, level, other, side));
  const own = nameSide === undefined ? [] : [nameBox(scene, level, id, nameSide)];
  let best: Side = 'above';
  let lowest = Infinity;
  for (const side of SIDES) {
    if (side === nameSide) {
      continue;
    }
    const value = cost(scene, id, labelBox(point, side, TAG_WIDTH, LABEL_HEIGHT), [
      ...names,
      ...own,
    ]);
    if (value < lowest) {
      lowest = value;
      best = side;
    }
  }
  return best;
}
