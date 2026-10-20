import { readFileSync } from 'node:fs';

import { type Page } from '@playwright/test';

import { type LevelRecord } from '../../src/games/backbone/data/pool';
import { expect, gameReady, test } from './fixtures';

/**
 * Every name, "from" and "to" mark, number of a flow and load of a cable that the map draws lies
 * inside the map, and none of them lies on another or on a cable. Measured in the page, for every
 * level of the campaign and for every flow that can be selected (the marks belong to the selected
 * flow). The only things that may touch are the numbers of the flows and their own node (they sit
 * on its corner) and a load and its own cable.
 */

const levels = JSON.parse(
  readFileSync('src/games/backbone/data/levels.json', 'utf8'),
) as LevelRecord[];

interface Box {
  kind: string;
  owner: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Measure {
  map: { x: number; y: number; width: number; height: number };
  boxes: Box[];
  nodes: Record<string, { x: number; y: number; width: number; height: number }>;
}

async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const rect = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const mapElement = document.querySelector('.bb-map');
    if (mapElement === null) {
      throw new Error('There is no map');
    }
    const map = rect(mapElement);
    const nodes: Record<string, ReturnType<typeof rect>> = {};
    for (const node of document.querySelectorAll<HTMLElement>('.bb-node')) {
      nodes[node.dataset.node ?? ''] = rect(node);
    }
    const boxes: Measure['boxes'] = [];
    const add = (kind: string, selector: string, owner: (element: Element) => string): void => {
      for (const element of document.querySelectorAll(selector)) {
        const box = rect(element);
        if (box.width > 0 && box.height > 0) {
          boxes.push({ kind, owner: owner(element), ...box });
        }
      }
    };
    const nodeOf = (element: Element): string =>
      element.closest<HTMLElement>('.bb-node')?.dataset.node ?? '';
    add('name', '.bb-node-name', nodeOf);
    add('tag', '.bb-node-tag', nodeOf);
    add('badge', '.bb-badge', nodeOf);
    // The load and the delay are pills of their own inside the label of a cable
    add(
      'load',
      '.bb-link-main, .bb-link-delay',
      (element) => element.closest<HTMLElement>('.bb-link-label')?.dataset.link ?? '',
    );
    return { map, boxes, nodes };
  });
}

const touching = (a: Box, b: Box, margin = 0.5): boolean =>
  a.x < b.x + b.width - margin &&
  b.x < a.x + a.width - margin &&
  a.y < b.y + b.height - margin &&
  b.y < a.y + a.height - margin;

/** Whether a segment passes through a box. */
function crosses(from: { x: number; y: number }, to: { x: number; y: number }, box: Box): boolean {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2);
  for (let step = 0; step <= steps; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / Math.max(1, steps);
    const y = from.y + ((to.y - from.y) * step) / Math.max(1, steps);
    if (x > box.x + 1 && x < box.x + box.width - 1 && y > box.y + 1 && y < box.y + box.height - 1) {
      return true;
    }
  }
  return false;
}

/**
 * On a phone the map is about 340 pixels wide and a node alone is 40: a name, a mark or a load
 * cannot always keep clear of a cable or a node there. So below this width (the map is 30 rem wide
 * where the compact look starts) only the rule that always can hold is checked: everything lies
 * inside the map.
 */
const COMPACT = 480;
/** The narrowest page that still has two columns (the map is a little wider than the compact one) */
const NARROW_DESKTOP = 880;

function problemsOf(record: LevelRecord, measured: Measure): string[] {
  const problems: string[] = [];
  const { map, boxes, nodes } = measured;
  const center = (id: string): { x: number; y: number } => {
    const node = nodes[id];
    return node === undefined
      ? { x: 0, y: 0 }
      : { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  };
  const label = (box: Box): string => `${box.kind} of ${box.owner}`;
  for (const box of boxes) {
    if (
      box.x < map.x ||
      box.y < map.y ||
      box.x + box.width > map.x + map.width ||
      box.y + box.height > map.y + map.height
    ) {
      problems.push(`${label(box)} is outside the map`);
    }
  }
  if (map.width < COMPACT) {
    return [...new Set(problems)];
  }
  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      const a = boxes[first];
      const b = boxes[second];
      if (a !== undefined && b !== undefined && touching(a, b)) {
        problems.push(`${label(a)} lies on ${label(b)}`);
      }
    }
  }
  for (const box of boxes) {
    for (const [id, node] of Object.entries(nodes)) {
      // The numbers of a flow sit on the corner of their own node
      if (box.kind === 'badge' && id === box.owner) {
        continue;
      }
      if (touching(box, { kind: 'node', owner: id, ...node })) {
        problems.push(`${label(box)} lies on the node ${id}`);
      }
    }
    for (const link of record.level.links) {
      if (box.kind === 'load' && box.owner === link.id) {
        continue;
      }
      // The numbers of a flow sit on the corner of their node, where its cables begin
      if (box.kind === 'badge' && (link.a === box.owner || link.b === box.owner)) {
        continue;
      }
      if (crosses(center(link.a), center(link.b), box)) {
        problems.push(`${label(box)} lies on the cable ${link.id}`);
      }
    }
  }
  return [...new Set(problems)];
}

async function open(page: Page, id: string): Promise<void> {
  await page.goto('/games/backbone/');
  await gameReady(page);
  await page.locator(`a[href="?level=${id}"]`).click();
  await expect(page.locator('.bb-node').first()).toBeVisible({ timeout: 15_000 });
}

const chapters = [...new Set(levels.map((record) => record.chapter))];

test.describe('Backbone: nothing on the map lies outside it or on something else', () => {
  for (const chapter of chapters) {
    test(`chapter ${String(chapter)}`, async ({ page }) => {
      test.setTimeout(240_000);
      for (const record of levels.filter((entry) => entry.chapter === chapter)) {
        const height = page.viewportSize()?.height ?? 900;
        const width = page.viewportSize()?.width ?? 0;
        await open(page, record.id);
        const found: string[] = [];
        // The page as it is, and on a desktop also the narrowest page with two columns
        for (const size of width >= 1000 ? [width, NARROW_DESKTOP] : [width]) {
          if (size !== width) {
            await page.setViewportSize({ width: size, height });
            await page.waitForTimeout(300);
          }
          // Once with no flow selected (names and numbers), then once for every flow (its marks)
          for (const [at, flow] of [undefined, ...record.level.flows].entries()) {
            if (flow !== undefined) {
              await page.getByRole('button', { name: new RegExp(`^Flow ${String(at)}: `) }).click();
            }
            for (const problem of problemsOf(record, await measure(page))) {
              found.push(`${String(size)} px, ${flow?.name ?? 'no flow'}: ${problem}`);
            }
          }
        }
        if (width >= 1000) {
          await page.setViewportSize({ width, height });
        }
        expect(found, record.id).toEqual([]);
      }
    });
  }
});
