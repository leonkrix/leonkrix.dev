import { geometryProblems } from './geometry';
import { indexLevel, routesOf, shortestPath } from './graph';
import { profiles } from './profiles';
import { outOfRange } from './simulate';
import type { Level } from './types';

/**
 * What is wrong with a level, in words. An empty list means the level is well formed: every id is
 * unique, every reference points somewhere, every number is in range, and every flow can get from
 * its source to its target in every step of every situation.
 */
export function problemsOfLevel(level: Level): string[] {
  const problems: string[] = [];
  const nodeIds = new Set<string>();
  for (const node of level.nodes) {
    if (nodeIds.has(node.id)) {
      problems.push(`node ${node.id} appears twice`);
    }
    nodeIds.add(node.id);
    if (node.x < 0 || node.x > 100 || node.y < 0 || node.y > 100) {
      problems.push(`node ${node.id} lies outside the drawing`);
    }
  }
  const linkIds = new Set<string>();
  for (const link of level.links) {
    if (linkIds.has(link.id)) {
      problems.push(`link ${link.id} appears twice`);
    }
    linkIds.add(link.id);
    if (!nodeIds.has(link.a) || !nodeIds.has(link.b) || link.a === link.b) {
      problems.push(`link ${link.id} does not join two different nodes`);
    }
    if (!Number.isInteger(link.capacity) || link.capacity < 1) {
      problems.push(`link ${link.id} needs a whole capacity of at least 1`);
    }
    if (!Number.isInteger(link.delay) || link.delay < 1) {
      problems.push(`link ${link.id} needs a whole delay of at least 1`);
    }
    if (link.loss < 0 || link.loss >= 1) {
      problems.push(`link ${link.id} has a loss outside 0 to 1`);
    }
  }
  const pairs = new Set(level.links.map((link) => [link.a, link.b].sort().join('~')));
  if (pairs.size !== level.links.length) {
    problems.push('two links join the same pair of nodes');
  }
  const flowIds = new Set<string>();
  for (const flow of level.flows) {
    if (flowIds.has(flow.id)) {
      problems.push(`flow ${flow.id} appears twice`);
    }
    flowIds.add(flow.id);
    if (!nodeIds.has(flow.source) || !nodeIds.has(flow.target) || flow.source === flow.target) {
      problems.push(`flow ${flow.id} needs two different nodes`);
    }
    if (!(flow.profile in profiles)) {
      problems.push(`flow ${flow.id} has an unknown profile`);
    }
    if (!Number.isInteger(flow.demand) || flow.demand < 1) {
      problems.push(`flow ${flow.id} needs a whole demand of at least 1`);
    }
  }
  if (level.flows.length === 0) {
    problems.push('the level has no flows');
  }
  if (level.situations.length < 1 || level.situations.length > 3) {
    problems.push('a level has one to three situations');
  }
  const situationIds = new Set<string>();
  for (const situation of level.situations) {
    if (situationIds.has(situation.id)) {
      problems.push(`situation ${situation.id} appears twice`);
    }
    situationIds.add(situation.id);
    if (!Number.isInteger(situation.steps) || situation.steps < 2 || situation.steps > 16) {
      problems.push(`situation ${situation.id} needs 2 to 16 steps`);
    }
    for (const event of situation.events) {
      if (!(0 <= event.from && event.from < event.to && event.to <= situation.steps)) {
        problems.push(`an event of ${situation.id} lies outside its steps`);
      }
      if (event.kind === 'burst') {
        if (!flowIds.has(event.flow) || event.factor <= 0) {
          problems.push(`a burst of ${situation.id} is wrong`);
        }
      } else if (event.kind === 'flood') {
        if (
          !nodeIds.has(event.source) ||
          !nodeIds.has(event.target) ||
          event.source === event.target ||
          event.rate <= 0
        ) {
          problems.push(`a flood of ${situation.id} is wrong`);
        }
      } else if (!linkIds.has(event.link)) {
        problems.push(`an event of ${situation.id} names a link that does not exist`);
      }
      if (event.kind === 'lossy' && (event.loss <= 0 || event.loss >= 1)) {
        problems.push(`a lossy event of ${situation.id} needs a loss between 0 and 1`);
      }
      if (event.kind === 'slow' && (event.factor <= 0 || event.factor >= 1)) {
        problems.push(`a slow event of ${situation.id} needs a factor between 0 and 1`);
      }
    }
  }
  if (problems.length > 0) {
    return problems;
  }
  problems.push(...geometryProblems(level));

  // Optional cables: a cost for each, a budget, and a network without them that still works
  const optional = level.links.filter((link) => link.optional === true);
  if (optional.length > 0) {
    if (optional.some((link) => !Number.isInteger(link.cost) || (link.cost ?? 0) < 1)) {
      problems.push('an optional cable needs a whole cost of at least 1');
    }
    if (!Number.isInteger(level.budget) || (level.budget ?? 0) < 1) {
      problems.push('a level with optional cables needs a whole budget of at least 1');
    }
    const base = indexLevel(level);
    for (const flow of level.flows) {
      if (
        shortestPath(
          base,
          flow.source,
          flow.target,
          (id) => base.linkById.get(id)?.optional !== true,
        ) === undefined
      ) {
        problems.push(`${flow.id} has no way through without the optional cables`);
      }
    }
  }

  // A flow that has to pass a node needs a route that does
  for (const flow of level.flows) {
    if ((flow.via ?? []).length > 0 && routesOf(indexLevel(level), flow, 1).length === 0) {
      problems.push(`${flow.id} has no route through the node it has to pass`);
    }
  }

  // Every flow needs a way through in every step, otherwise nobody could score the level fully.
  const index = indexLevel(level);
  for (const situation of level.situations) {
    for (let step = 0; step < situation.steps; step += 1) {
      const down = new Set(
        situation.events.flatMap((event) =>
          event.kind === 'down' && step >= event.from && step < event.to ? [event.link] : [],
        ),
      );
      for (const link of level.links) {
        if (outOfRange(situation, link.id, step)) {
          down.add(link.id);
        }
      }
      for (const flow of level.flows) {
        if (flow.via?.some((node) => !nodeIds.has(node)) === true) {
          problems.push(`${flow.id} has to pass a node that does not exist`);
        }
        if (shortestPath(index, flow.source, flow.target, (id) => !down.has(id)) === undefined) {
          problems.push(`${flow.id} has no way through in step ${String(step)} of ${situation.id}`);
        }
      }
    }
  }
  return problems;
}
