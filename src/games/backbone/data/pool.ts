import type { Level, Plan, Rules } from '../logic/types';

/**
 * One level of the pool as it is stored in `levels.json`: the level itself, the plan the solver
 * proved best, and the scores that decide the stars. Everything is plain JSON.
 */
export interface LevelRecord {
  id: string;
  chapter: number;
  /** The seed that made the level, so it can be made again */
  seed: number;
  level: Level;
  /** The proven best plan and its score */
  best: { plan: Plan; score: number };
  /** The scores of the two simple strategies */
  shortest: number;
  balanced: number;
  /** How long the proof took and how many partial plans it looked at */
  proof: { milliseconds: number; explored: number };
}

/** Which options a plan really uses, to see that the best plan needs what the chapter teaches. */
export function featuresUsed(plan: Plan): Rules {
  const used: Rules = {
    split: false,
    backup: false,
    redundancy: false,
    throttle: false,
    stages: false,
  };
  for (const flowPlan of Object.values(plan)) {
    used.split ||= flowPlan.stages.some((stage) => stage.paths.length > 1);
    used.stages ||= flowPlan.stages.length > 1;
    used.backup ||= flowPlan.backup !== undefined;
    used.redundancy ||= flowPlan.redundancy > 0;
    used.throttle ||= flowPlan.throttle < 1;
  }
  return used;
}
