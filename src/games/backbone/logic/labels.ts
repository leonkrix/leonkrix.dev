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
/** The numbers of the flows that start or end at a node sit on its top right corner (CSS: `.bb-node-badges`) */
const BADGE = { width: 3, height: 2.7, left: 2.5, top: -5.2 };
/** A name above a node is lifted by this much when it would touch the numbers (they reach 0.45 rem above the node) */
const LIFT = 1.1;
/** Nothing is placed closer than this to the border of the map (sideways, and up and down) */
const BORDER_X = 2.5;
const BORDER_Y = 2;

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
  /** The rows of flow numbers on the corners of the nodes, nothing may lie on them */
  badges: Box[];
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
  const badges = level.nodes.flatMap((node) => {
    const count = level.flows.filter(
      (flow) => flow.source === node.id || flow.target === node.id,
    ).length;
    const point = nodes.get(node.id);
    return count === 0 || point === undefined
      ? []
      : [
          {
            x: point.x + BADGE.left,
            y: point.y + BADGE.top,
            width: BADGE.width * count,
            height: BADGE.height,
          },
        ];
  });
  return { nodes, segments, linkLabels, badges };
}

/** How badly a label box collides with the rest of the drawing (0 is perfect). */
function cost(
  scene: Scene,
  owner: string,
  box: Box,
  placed: readonly Box[],
  badges: boolean,
): number {
  let total = 0;
  if (
    box.x < BORDER_X ||
    box.y < BORDER_Y ||
    box.x + box.width > MAP_WIDTH - BORDER_X ||
    box.y + box.height > MAP_HEIGHT - BORDER_Y
  ) {
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
  if (badges) {
    for (const badge of scene.badges) {
      if (boxesOverlap(box, badge, 0.3)) {
        total += 100;
      }
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
  /** The names that sit one badge higher than usual because the numbers of the flows are there */
  lifted: ReadonlySet<string>;
  /** What is still colliding, summed over all labels (0 means nothing is) */
  conflicts: number;
}

function nameBox(scene: Scene, level: Level, id: string, side: Side, lifted = false): Box {
  const node = level.nodes.find((entry) => entry.id === id);
  const point = scene.nodes.get(id) ?? { x: 0, y: 0 };
  const width = Math.max(4, (node?.name.length ?? 4) * CHARACTER_WIDTH + 1.2);
  const box = labelBox(point, side, width, LABEL_HEIGHT);
  return lifted ? { ...box, y: box.y - LIFT } : box;
}

/** Only names above a node can lie on its numbers (they are on the top right corner). */
const isAbove = (side: Side): boolean => side.startsWith('above');

/**
 * Chooses a side for the name of every node: the one with the fewest collisions, below first.
 * Where the name would lie on the numbers of the flows it is lifted a little instead of moving
 * to another side; only when that does not help it takes the side that is free.
 */
export function placeNames(level: Level): Placement {
  const scene = sceneOf(level);
  const chosen = new Map<string, Side>();
  const lifted = new Set<string>();
  const order = [...level.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const othersOf = (id: string): Box[] =>
    [...chosen]
      .filter(([other]) => other !== id)
      .map(([other, side]) => nameBox(scene, level, other, side, lifted.has(other)));
  // Rounds, so that the later nodes see the sides the earlier ones took
  for (let round = 0; round < 3; round += 1) {
    for (const node of order) {
      const others = othersOf(node.id);
      let best: Side = 'below';
      let lowest = Infinity;
      for (const side of SIDES) {
        const value = cost(scene, node.id, nameBox(scene, level, node.id, side), others, false);
        if (value < lowest) {
          lowest = value;
          best = side;
        }
      }
      chosen.set(node.id, best);
    }
  }
  // The numbers of the flows: lift the name, or as a last resort look for another side
  for (const node of order) {
    const side = chosen.get(node.id) ?? 'below';
    const others = othersOf(node.id);
    const plain = cost(scene, node.id, nameBox(scene, level, node.id, side), others, true);
    if (plain === 0) {
      continue;
    }
    if (
      isAbove(side) &&
      cost(scene, node.id, nameBox(scene, level, node.id, side, true), others, true) === 0
    ) {
      lifted.add(node.id);
      continue;
    }
    let best = { side, lift: false, value: plain };
    for (const other of SIDES) {
      for (const lift of isAbove(other) ? [false, true] : [false]) {
        const value = cost(
          scene,
          node.id,
          nameBox(scene, level, node.id, other, lift),
          others,
          true,
        );
        if (value < best.value) {
          best = { side: other, lift, value };
        }
      }
    }
    chosen.set(node.id, best.side);
    if (best.lift) {
      lifted.add(node.id);
    }
  }
  let conflicts = 0;
  for (const node of level.nodes) {
    conflicts += cost(
      scene,
      node.id,
      nameBox(scene, level, node.id, chosen.get(node.id) ?? 'below', lifted.has(node.id)),
      othersOf(node.id),
      true,
    );
  }
  return { names: chosen, lifted, conflicts };
}

/** The best side for the "from" or "to" mark of a node and how badly it still collides (0 is fine). */
function bestTag(level: Level, placement: Placement, id: string): { side: Side; cost: number } {
  const scene = sceneOf(level);
  const point = scene.nodes.get(id) ?? { x: 0, y: 0 };
  const nameSide = placement.names.get(id);
  const names = [...placement.names]
    .filter(([other]) => other !== id)
    .map(([other, side]) => nameBox(scene, level, other, side, placement.lifted.has(other)));
  const own =
    nameSide === undefined ? [] : [nameBox(scene, level, id, nameSide, placement.lifted.has(id))];
  let best: Side = 'above';
  let lowest = Infinity;
  for (const side of SIDES) {
    if (side === nameSide) {
      continue;
    }
    const value = cost(
      scene,
      id,
      labelBox(point, side, TAG_WIDTH, LABEL_HEIGHT),
      [...names, ...own],
      true,
    );
    if (value < lowest) {
      lowest = value;
      best = side;
    }
  }
  return { side: best, cost: lowest };
}

/** The side for the "from" or "to" mark of a node: free of cables, numbers and the name. */
export function placeTag(level: Level, placement: Placement, id: string): Side {
  return bestTag(level, placement, id).side;
}

/** What is still colliding with the "from" and "to" marks the flows of the level can have (0 is fine). */
export function tagConflicts(level: Level, placement: Placement): number {
  let total = 0;
  for (const flow of level.flows) {
    total +=
      bestTag(level, placement, flow.source).cost + bestTag(level, placement, flow.target).cost;
  }
  return total;
}
