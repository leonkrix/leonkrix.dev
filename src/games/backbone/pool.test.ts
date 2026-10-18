import { describe, expect, it } from 'vitest';

import { LEVEL_PLAN } from './data/campaign-plan';
import catalogJson from './data/catalog.json';
import levelsJson from './data/levels.json';
import {
  type CatalogEntry,
  featuresUsed,
  type LevelRecord,
  QUEUE_GAIN,
  queueGain,
  toCatalogEntry,
} from './data/pool';
import { settings } from './data/settings';
import { withBuilt } from './logic/build';
import { distinctDemandsWanted } from './logic/generate';
import { indexLevel } from './logic/graph';
import { placeNames, tagConflicts } from './logic/labels';
import { problemsOfPlan } from './logic/plan';
import { evaluate } from './logic/simulate';
import { solveDesign } from './logic/solver';
import { isAdmissible, starsFor, starThresholds, strategyScores } from './logic/stars';
import { problemsOfLevel } from './logic/validate';

const records = levelsJson as unknown as LevelRecord[];
const catalog = catalogJson as unknown as CatalogEntry[];

/** Proofs that took longer than this are not repeated in the tests (the script proved them once). */
const CHEAP_PROOF_MS = 400;

describe('the level pool', () => {
  it('has only levels of the plan, in the order of the plan', () => {
    const order = LEVEL_PLAN.map((plan) => plan.id);
    const ids = records.map((record) => record.id);
    expect(ids.every((id) => order.includes(id))).toBe(true);
    expect(ids).toEqual(order.filter((id) => ids.includes(id)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a level for every planned level', () => {
    const missing = LEVEL_PLAN.filter((plan) => !records.some((record) => record.id === plan.id));
    expect(missing.map((plan) => plan.id)).toEqual([]);
  });

  it('has a catalog that matches the pool', () => {
    expect(catalog).toEqual(records.map((record) => toCatalogEntry(record)));
  });

  describe.each(records)('level $id', (record) => {
    const plan = LEVEL_PLAN.find((entry) => entry.id === record.id);
    const index = indexLevel(withBuilt(record.level, record.best.built));

    it('follows its plan', () => {
      expect(plan).toBeDefined();
      expect(record.chapter).toBe(plan?.chapter);
      expect(record.setting).toBe(plan?.setting);
      expect(record.level.id).toBe(record.id);
      expect(record.level.title).toBe(plan?.title);
      expect(record.level.story).toBe(plan?.story);
      expect(record.level.nodes).toHaveLength(plan?.nodes ?? -1);
      expect(record.level.flows.map((flow) => flow.profile)).toEqual(plan?.profiles);
      expect(record.level.situations.map((situation) => situation.id)).toEqual(plan?.situations);
    });

    it('has flows that send different amounts', () => {
      const demands = record.level.flows.map((flow) => flow.demand);
      expect(new Set(demands).size).toBeGreaterThanOrEqual(distinctDemandsWanted(demands.length));
    });

    it('is well formed, drawn without overlaps and named from its setting', () => {
      expect(problemsOfLevel(record.level)).toEqual([]);
      const placement = placeNames(record.level);
      expect(placement.conflicts).toBe(0);
      // The "from" and "to" marks of every flow have a free place too
      expect(tagConflicts(record.level, placement)).toBe(0);
      const pool = settings[record.setting];
      expect(pool.name.length).toBeGreaterThan(2);
      expect(new Set(record.level.nodes.map((node) => node.name)).size).toBe(
        record.level.nodes.length,
      );
    });

    it('stores a runnable best plan with the score the stress test gives it', () => {
      expect(Object.keys(record.best.plan).sort()).toEqual(
        record.level.flows.map((flow) => flow.id).sort(),
      );
      expect(problemsOfPlan(index, record.best.plan)).toEqual([]);
      expect(evaluate(index, record.best.plan).score).toBeCloseTo(record.best.score, 9);
    });

    it('stores the scores of the two simple strategies', () => {
      const scores = strategyScores(record.level);
      expect(scores.shortest).toBeCloseTo(record.shortest, 9);
      expect(scores.balanced).toBeCloseTo(record.balanced, 9);
    });

    it('leaves room for the stars, and its best plan uses what the chapter teaches', () => {
      const baselines = {
        shortest: record.shortest,
        balanced: record.balanced,
        best: record.best.score,
      };
      expect(isAdmissible(baselines)).toBe(true);
      const thresholds = starThresholds(baselines);
      expect(thresholds.one).toBeLessThan(thresholds.two);
      expect(thresholds.two).toBeLessThan(thresholds.three);
      expect(starsFor(record.best.score, thresholds)).toBe(3);
      expect(starsFor(record.shortest, thresholds)).toBe(1);
      expect(record.best.score).toBeGreaterThanOrEqual(plan?.minBest ?? 1);
      const used = featuresUsed(record.best.plan);
      for (const rule of plan?.requires ?? []) {
        if (rule === 'queues') {
          expect(queueGain(record), 'the buffers change the score').toBeGreaterThanOrEqual(
            QUEUE_GAIN,
          );
        } else {
          expect(used[rule], rule).toBe(true);
        }
      }
    });

    it('only uses options of its chapter', () => {
      const used = featuresUsed(record.best.plan);
      for (const rule of ['split', 'backup', 'redundancy', 'throttle', 'stages'] as const) {
        if (!record.level.rules[rule]) {
          expect(used[rule], rule).toBe(false);
        }
      }
    });

    it.runIf(record.proof.milliseconds <= CHEAP_PROOF_MS)(
      'is proven again when the proof was cheap',
      () => {
        const solution = solveDesign(record.level, {
          limits: { pathLimit: record.chapter >= 5 ? 4 : 5 },
          timeLimitMs: 30_000,
        });
        expect(solution.complete).toBe(true);
        expect(solution.score).toBeCloseTo(record.best.score, 9);
      },
      60_000,
    );
  });
});
