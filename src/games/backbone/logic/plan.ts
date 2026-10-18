import { indexLevel, type LevelIndex, linksOfPath } from './graph';
import { profiles } from './profiles';
import { obeysPolicy } from './simulate';
import type { FlowPlan, Level, NodePath, Plan } from './types';

/** A plan for one flow that sends everything on one path. */
export function singlePath(path: NodePath): FlowPlan {
  return { stages: [{ from: 0, paths: [{ nodes: path, share: 1 }] }], redundancy: 0, throttle: 1 };
}

const SHARE_STEP = 0.25;
const MOST_PATHS = 3;

/**
 * What is wrong with a plan, in words for the interface and the tests. An empty list means the plan
 * can be run. A plan may leave flows out.
 */
export function problemsOfPlan(level: Level | LevelIndex, plan: Plan): string[] {
  const index = 'linkById' in level ? level : indexLevel(level);
  const problems: string[] = [];
  for (const [flowId, flowPlan] of Object.entries(plan)) {
    const flow = index.level.flows.find((candidate) => candidate.id === flowId);
    if (flow === undefined) {
      problems.push(`${flowId}: there is no such flow`);
      continue;
    }
    const checkPath = (path: NodePath, what: string): void => {
      if (linksOfPath(index, path) === undefined) {
        problems.push(`${flowId}: ${what} is not a path of the network`);
      } else if (path[0] !== flow.source || path[path.length - 1] !== flow.target) {
        problems.push(`${flowId}: ${what} does not go from the source to the target`);
      } else if (!obeysPolicy(flow, path)) {
        problems.push(`${flowId}: ${what} skips a node the flow has to pass`);
      }
    };
    if (flowPlan.stages.length === 0 || flowPlan.stages[0]?.from !== 0) {
      problems.push(`${flowId}: the first stage must start at step 0`);
    }
    flowPlan.stages.forEach((stage, position) => {
      if (position > 0 && stage.from <= (flowPlan.stages[position - 1]?.from ?? 0)) {
        problems.push(`${flowId}: the stages must start at later and later steps`);
      }
      const total = stage.paths.reduce((sum, path) => sum + path.share, 0);
      if (
        stage.paths.length === 0 ||
        stage.paths.length > MOST_PATHS ||
        Math.abs(total - 1) > 1e-9
      ) {
        problems.push(
          `${flowId}: a stage needs one to ${String(MOST_PATHS)} paths whose shares add up to 1`,
        );
      }
      for (const path of stage.paths) {
        const steps = path.share / SHARE_STEP;
        if (path.share <= 0 || Math.abs(steps - Math.round(steps)) > 1e-9) {
          problems.push(`${flowId}: shares go in steps of a quarter`);
        }
        checkPath(path.nodes, 'a path');
      }
    });
    if (flowPlan.backup !== undefined) {
      checkPath(flowPlan.backup, 'the backup');
    }
    if (!(flowPlan.throttle > 0 && flowPlan.throttle <= 1)) {
      problems.push(`${flowId}: the throttle must be more than 0 and at most 1`);
    } else if (flowPlan.throttle < 1 && !profiles[flow.profile].throttlable) {
      problems.push(`${flowId}: ${profiles[flow.profile].name} traffic cannot be held back`);
    }
  }
  return problems;
}
