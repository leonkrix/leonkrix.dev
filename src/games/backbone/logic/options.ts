import { type LevelIndex, routesOf } from './graph';
import { profiles } from './profiles';
import type { Flow, FlowPlan, NodePath, Redundancy, WeightedPath } from './types';

/**
 * Every way one flow can be planned, given the rules of the level. The solver looks at exactly
 * these, so "the best plan" means the best plan made of these options.
 *
 * Paths come from the fastest `pathLimit` simple paths of the network. A player can draw a slower
 * path than that; it cannot be better than the best plan the solver proves, because the level
 * gate only admits levels where the candidate paths include every path that could matter.
 */

export interface OptionLimits {
  /** How many paths per flow the solver considers */
  pathLimit: number;
}

export const defaultLimits: OptionLimits = { pathLimit: 5 };

const SPLITS: readonly (readonly number[])[] = [
  [0.5, 0.5],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.5, 0.25, 0.25],
  [0.25, 0.5, 0.25],
  [0.25, 0.25, 0.5],
];

function stageChoices(paths: readonly NodePath[], split: boolean): WeightedPath[][] {
  const choices: WeightedPath[][] = paths.map((nodes) => [{ nodes, share: 1 }]);
  if (!split) {
    return choices;
  }
  const seen = new Set<string>();
  for (const shares of SPLITS) {
    // Every ordered pick of distinct paths gets the shares in order; picks that are the same plan
    // in another order are dropped by their canonical key.
    const pick = (chosen: number[]): void => {
      if (chosen.length === shares.length) {
        const choice = chosen.map((at, position) => ({
          nodes: paths[at] ?? [],
          share: shares[position] ?? 0,
        }));
        const key = choice
          .map((entry) => `${entry.nodes.join()}:${String(entry.share)}`)
          .sort()
          .join('|');
        if (!seen.has(key)) {
          seen.add(key);
          choices.push(choice);
        }
        return;
      }
      for (let at = 0; at < paths.length; at += 1) {
        if (!chosen.includes(at)) {
          pick([...chosen, at]);
        }
      }
    };
    pick([]);
  }
  return choices;
}

/** The steps at which something starts or stops, where a planned change of path can matter. */
export function switchSteps(index: LevelIndex): number[] {
  const steps = new Set<number>();
  for (const situation of index.level.situations) {
    for (const event of situation.events) {
      for (const step of [event.from, event.to]) {
        if (step > 0 && step < situation.steps) {
          steps.add(step);
        }
      }
    }
  }
  return [...steps].sort((a, b) => a - b);
}

export function flowOptions(
  index: LevelIndex,
  flow: Flow,
  limits: OptionLimits = defaultLimits,
): FlowPlan[] {
  const { rules } = index.level;
  const paths = routesOf(index, flow, limits.pathLimit);
  const options: FlowPlan[] = [];
  const redundancies: Redundancy[] = rules.redundancy ? [0, 0.25, 0.5] : [0];
  const throttles = rules.throttle && profiles[flow.profile].throttlable ? [1, 0.5, 0.25] : [1];

  const stageSets: FlowPlan['stages'][] = stageChoices(paths, rules.split).map((choice) => [
    { from: 0, paths: choice },
  ]);
  if (rules.stages) {
    for (const at of switchSteps(index)) {
      for (const first of paths) {
        for (const second of paths) {
          if (first !== second) {
            stageSets.push([
              { from: 0, paths: [{ nodes: first, share: 1 }] },
              { from: at, paths: [{ nodes: second, share: 1 }] },
            ]);
          }
        }
      }
    }
  }

  for (const stages of stageSets) {
    const inUse = new Set(
      stages.flatMap((stage) => stage.paths.map((entry) => entry.nodes.join())),
    );
    const backups: (NodePath | undefined)[] = [undefined];
    if (rules.backup) {
      backups.push(...paths.filter((path) => !inUse.has(path.join())));
    }
    for (const redundancy of redundancies) {
      for (const throttle of throttles) {
        for (const backup of backups) {
          options.push({
            stages,
            redundancy,
            throttle,
            ...(backup === undefined ? {} : { backup }),
          });
        }
      }
    }
  }
  return options;
}
