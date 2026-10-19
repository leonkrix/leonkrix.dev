import { distanceToSegment, MAP_HEIGHT, MAP_WIDTH, mapPoint, type Point } from './geometry';
import { showsDelay } from './latency';
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

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The pixels of a map unit at the width the labels were first drawn for (a map 590 pixels wide). */
export const BASE_UNIT = 5.9;

/**
 * The sizes of everything that is drawn around the nodes, in units of the map. The page draws them
 * in rem, so their size in pixels does not change with the map, and a unit is fewer pixels on a
 * small map: the same label is more units wide. `unit` is the number of pixels of one unit
 * (the width of the map divided by 100).
 */
function sizesFor(unit: number, withDelay = false) {
  const base = (units: number): number => (units * BASE_UNIT) / unit;
  return {
    // A node is 2.75 rem wide, 2.5 rem on a map narrower than 30 rem (the names are mostly hidden there)
    node: unit * 100 < 480 ? 40 / unit : base(8),
    gap: base(0.9),
    labelHeight: base(2.3),
    characterWidth: base(0.88),
    // The "from" mark is about 31 pixels wide and 15 high, and 0.5 rem away from the node
    tagWidth: base(5.25),
    tagHeight: base(2.55),
    tagGap: base(1.36),
    // With the delay of the cable under the load the label has two lines
    linkLabel: { width: base(7.4), height: base(withDelay ? 4.2 : 2.5) },
    /** The numbers of the flows sit on a corner of the node (CSS: `.bb-node-badges`) */
    badge: { width: base(3), height: base(2.7), left: base(2.5), top: base(-5.2) },
    /** A name above a node is lifted by this much when it would touch the numbers */
    lift: base(1.1),
    /** Nothing is placed closer than this to the border of the map */
    borderX: base(2.5),
    borderY: base(2),
    /** How far a label in a corner starts from the middle of its node, sideways */
    corner: base(2.2),
    cornerGap: base(0.6),
  };
}

type Sizes = ReturnType<typeof sizesFor>;

function boxAt(center: Point, width: number, height: number): Box {
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

/** The box of a label of the given size on one side of a node. */
function labelBox(
  sizes: Sizes,
  node: Point,
  side: Side,
  width: number,
  height: number,
  gap = sizes.gap,
): Box {
  const reach = sizes.node / 2 + gap;
  const { corner, cornerGap } = sizes;
  const half = sizes.node / 2;
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
        { x: node.x + corner + width / 2, y: node.y + half + cornerGap + height / 2 },
        width,
        height,
      );
    case 'below-left':
      return boxAt(
        { x: node.x - corner - width / 2, y: node.y + half + cornerGap + height / 2 },
        width,
        height,
      );
    case 'above-right':
      return boxAt(
        { x: node.x + corner + width / 2, y: node.y - half - cornerGap - height / 2 },
        width,
        height,
      );
    case 'above-left':
      return boxAt(
        { x: node.x - corner - width / 2, y: node.y - half - cornerGap - height / 2 },
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

/** Where along its cable (0 is the first node, 1 the second) the load of a cable is shown. */
const LOAD_POSITIONS = [0.5, 0.44, 0.56, 0.38, 0.62, 0.32, 0.68, 0.26, 0.74];

function loadBox(sizes: Sizes, segment: { from: Point; to: Point }, at: number): Box {
  return boxAt(
    {
      x: segment.from.x + (segment.to.x - segment.from.x) * at,
      y: segment.from.y + (segment.to.y - segment.from.y) * at,
    },
    sizes.linkLabel.width,
    sizes.linkLabel.height,
  );
}

interface Scene {
  nodes: Map<string, Point>;
  segments: { id: string; from: Point; to: Point }[];
  linkLabels: Box[];
  /** The rows of flow numbers on the corners of the nodes, nothing may lie on them */
  badges: Box[];
  /** The nodes whose numbers sit on the top left corner, because the right one is too near the border */
  badgesLeft: Set<string>;
  sizes: Sizes;
  /** Pixels of one unit of the map */
  unit: number;
}

function sceneOf(level: Level, unit: number, loads?: ReadonlyMap<string, number>): Scene {
  const sizes = sizesFor(unit, showsDelay(level));
  const nodes = new Map(level.nodes.map((node) => [node.id, mapPoint(node)]));
  const segments = level.links.flatMap((link) => {
    const from = nodes.get(link.a);
    const to = nodes.get(link.b);
    return from === undefined || to === undefined ? [] : [{ id: link.id, from, to }];
  });
  const linkLabels = segments.map((segment) =>
    loadBox(sizes, segment, loads?.get(segment.id) ?? 0.5),
  );
  const badgesLeft = new Set<string>();
  const badges = level.nodes.flatMap((node) => {
    const count = level.flows.filter(
      (flow) => flow.source === node.id || flow.target === node.id,
    ).length;
    const point = nodes.get(node.id);
    if (count === 0 || point === undefined) {
      return [];
    }
    const { badge } = sizes;
    const width = badge.width * count;
    // The numbers sit on the top right corner, and on the top left one when they would reach the border
    const left = point.x + badge.left + width > MAP_WIDTH - sizes.borderX;
    if (left) {
      badgesLeft.add(node.id);
    }
    return [
      {
        x: left ? point.x - badge.left - width : point.x + badge.left,
        y: point.y + badge.top,
        width,
        height: badge.height,
      },
    ];
  });
  return { nodes, segments, linkLabels, badges, badgesLeft, sizes, unit };
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
    box.x < scene.sizes.borderX ||
    box.y < scene.sizes.borderY ||
    box.x + box.width > MAP_WIDTH - scene.sizes.borderX ||
    box.y + box.height > MAP_HEIGHT - scene.sizes.borderY
  ) {
    total += 200;
  }
  for (const [id, point] of scene.nodes) {
    if (id !== owner && boxesOverlap(box, boxAt(point, scene.sizes.node, scene.sizes.node), 0.4)) {
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
  /** The nodes whose numbers of flows sit on the top left corner instead of the top right one */
  badgesLeft: ReadonlySet<string>;
  /** For every cable: where along it the load is shown (0 to 1, usually the middle) */
  loads: ReadonlyMap<string, number>;
  /** The pixels of a unit of the map that the placement was made for */
  unit: number;
  /** What is still colliding, summed over all labels (0 means nothing is) */
  conflicts: number;
}

function nameBox(scene: Scene, level: Level, id: string, side: Side, lifted = false): Box {
  const node = level.nodes.find((entry) => entry.id === id);
  const point = scene.nodes.get(id) ?? { x: 0, y: 0 };
  const { sizes } = scene;
  const width = Math.max(
    (4 * BASE_UNIT) / scene.unit,
    (node?.name.length ?? 4) * sizes.characterWidth + (1.2 * BASE_UNIT) / scene.unit,
  );
  const box = labelBox(sizes, point, side, width, sizes.labelHeight);
  return lifted ? { ...box, y: box.y - sizes.lift } : box;
}

/** Only names above a node can lie on its numbers (they are on the top right corner). */
const isAbove = (side: Side): boolean => side.startsWith('above');

/**
 * Chooses a side for the name of every node: the one with the fewest collisions, below first.
 * Where the name would lie on the numbers of the flows it is lifted a little instead of moving
 * to another side; only when that does not help it takes the side that is free.
 */
export function placeNames(level: Level, unit = BASE_UNIT): Placement {
  const scene = sceneOf(level, unit);
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
  // The loads of the cables sit in the middle of them, a little to the side where something is there
  const loads = new Map<string, number>();
  const obstacles: Box[] = [
    ...scene.badges,
    ...level.nodes.map((node) =>
      boxAt(scene.nodes.get(node.id) ?? { x: 0, y: 0 }, scene.sizes.node, scene.sizes.node),
    ),
    ...level.nodes.map((node) =>
      nameBox(scene, level, node.id, chosen.get(node.id) ?? 'below', lifted.has(node.id)),
    ),
  ];
  const settled: Box[] = [];
  let conflicts = 0;
  for (const segment of scene.segments) {
    let best = { at: 0.5, value: Infinity, box: loadBox(scene.sizes, segment, 0.5) };
    for (const at of LOAD_POSITIONS) {
      const box = loadBox(scene.sizes, segment, at);
      const value =
        [...obstacles, ...settled].filter((other) => boxesOverlap(box, other, 0.3)).length * 100 +
        Math.abs(at - 0.5);
      if (value < best.value) {
        best = { at, value, box };
      }
    }
    loads.set(segment.id, best.at);
    settled.push(best.box);
    conflicts += Math.floor(best.value / 100) * 100;
  }
  scene.linkLabels = settled;
  for (const node of level.nodes) {
    conflicts += cost(
      scene,
      node.id,
      nameBox(scene, level, node.id, chosen.get(node.id) ?? 'below', lifted.has(node.id)),
      othersOf(node.id),
      true,
    );
  }
  return { names: chosen, lifted, badgesLeft: scene.badgesLeft, loads, unit, conflicts };
}

/** The best side for the "from" or "to" mark of a node and how badly it still collides (0 is fine). */
function bestTag(level: Level, placement: Placement, id: string): { side: Side; cost: number } {
  const scene = sceneOf(level, placement.unit, placement.loads);
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
      labelBox(
        scene.sizes,
        point,
        side,
        scene.sizes.tagWidth,
        scene.sizes.tagHeight,
        scene.sizes.tagGap,
      ),
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
