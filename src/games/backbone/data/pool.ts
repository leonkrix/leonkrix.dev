import { withBuilt } from '../logic/build';
import { indexLevel } from '../logic/graph';
import { evaluate } from '../logic/simulate';
import type { Level, Plan, Rules } from '../logic/types';
import type { SettingId } from './settings';

/**
 * One level of the pool as it is stored in `levels.json`: the level itself, the plan the solver
 * proved best, and the scores that decide the stars. Everything is plain JSON.
 */
export interface LevelRecord {
  id: string;
  chapter: number;
  /** Where the level takes place (its names come from there) */
  setting: SettingId;
  /** The seed that made the level, so it can be made again */
  seed: number;
  level: Level;
  /** The proven best plan, the optional cables it builds, and its score */
  best: { plan: Plan; score: number; built: string[] };
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
    queues: false,
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

/** What the overview of the campaign needs to know about a level: small, so it is always at hand. */
export interface CatalogEntry {
  id: string;
  chapter: number;
  setting: SettingId;
  title: string;
  nodes: number;
  flows: number;
  situations: number;
}

export function toCatalogEntry(record: LevelRecord): CatalogEntry {
  return {
    id: record.id,
    chapter: record.chapter,
    setting: record.setting,
    title: record.level.title,
    nodes: record.level.nodes.length,
    flows: record.level.flows.length,
    situations: record.level.situations.length,
  };
}

/** How much the buffers of a level matter: what the best plan scores with them, minus without. */
export function queueGain(record: LevelRecord): number {
  const without = { ...record.level, rules: { ...record.level.rules, queues: false } };
  const index = indexLevel(withBuilt(without, record.best.built));
  return record.best.score - evaluate(index, record.best.plan).score;
}

/** The least the buffers have to change the score in a level of the chapter about queues. */
export const QUEUE_GAIN = 0.03;
