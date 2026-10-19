/**
 * Makes the level pool of Backbone (`src/games/backbone/data/levels.json`).
 *
 * Run it with `pnpm levels-backbone`. Levels that are in the file already are kept (they are only
 * made again with LEVELS_FORCE=1), so the file changes only when you ask for it. Settings:
 *   LEVELS=c1-1,c3-2       only these levels
 *   LEVELS_OUT=file.json   write to another file (to make several levels in parallel)
 *   LEVELS_FORCE=1         make levels again even if they exist
 *   LEVELS_CANDIDATES=4    how many levels that pass the gate to compare (the one with the biggest
 *                          gap between the best plan and the simple strategies is kept)
 *   LEVELS_PROOF_MS=20000  the longest a proof may take, a seed that needs more is dropped
 *   LEVELS_JOIN=a.json,b.json  merge files made in parallel into the pool
 *   LEVELS_RESOLVE=1       keep the levels, prove their best plan again (after the model or the
 *                          options of the solver changed); a level that then fails a check is
 *                          listed and has to be made again
 *
 * For every level the script tries seeds "<id>-1", "<id>-2", ... until the generator makes a
 * level that is well formed, whose best plan is proven in time, that leaves room for the stars
 * (`isAdmissible`) and whose best plan uses the rules the chapter teaches (`requires`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { format, resolveConfig } from 'prettier';
import { describe, it } from 'vitest';

import { LEVEL_PLAN, specOf } from '../src/games/backbone/data/campaign-plan';
import {
  featuresUsed,
  type LevelRecord,
  QUEUE_GAIN,
  queueGain,
  toCatalogEntry,
} from '../src/games/backbone/data/pool';
import { dress } from '../src/games/backbone/data/settings';
import { generateChecked } from '../src/games/backbone/logic/generate';
import { placeNames, tagConflicts } from '../src/games/backbone/logic/labels';
import { solveDesign } from '../src/games/backbone/logic/solver';
import { isAdmissible, strategyScores } from '../src/games/backbone/logic/stars';
import { hashSeed } from '../src/games/shared/random';

const DEFAULT_OUT = 'src/games/backbone/data/levels.json';
const out = resolve(process.env.LEVELS_OUT ?? DEFAULT_OUT);
const only = process.env.LEVELS?.split(',').filter((id) => id !== '');
const force = process.env.LEVELS_FORCE === '1';
const candidateCount = Number(process.env.LEVELS_CANDIDATES ?? '4');
const proofMs = Number(process.env.LEVELS_PROOF_MS ?? '20000');
const join = process.env.LEVELS_JOIN?.split(',').filter((file) => file !== '');
const resolveOnly = process.env.LEVELS_RESOLVE === '1';
const MAX_SEEDS = 600;

function load(file: string): LevelRecord[] {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as LevelRecord[]) : [];
}

/** Writes the file the way Prettier formats JSON, so that the format check passes */
async function write(file: string, data: unknown): Promise<void> {
  const options = await resolveConfig(file);
  writeFileSync(file, await format(JSON.stringify(data), { ...options, filepath: file }));
}

async function save(records: LevelRecord[]): Promise<void> {
  const order = LEVEL_PLAN.map((plan) => plan.id);
  records.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  await write(out, records);
  // The overview of the campaign reads a small file instead of the whole pool
  if (out === resolve(DEFAULT_OUT)) {
    await write(
      resolve('src/games/backbone/data/catalog.json'),
      records.map((record) => toCatalogEntry(record)),
    );
  }
}

function makeRecord(plan: (typeof LEVEL_PLAN)[number], number: number): LevelRecord | undefined {
  const seed = hashSeed(`${plan.id}-${String(number)}`);
  const { level: raw, problems } = generateChecked(specOf(plan, seed));
  if (problems.length > 0) {
    return undefined;
  }
  const level = dress(raw, plan.setting);
  // Every name must have a place on the map where it covers nothing
  const placement = placeNames(level);
  if (placement.conflicts > 0 || tagConflicts(level, placement) > 0) {
    return undefined;
  }
  return proveRecord(plan, level, seed);
}

/** Proves the best plan of a dressed level and applies the checks of the chapter */
function proveRecord(
  plan: (typeof LEVEL_PLAN)[number],
  level: ReturnType<typeof dress>,
  seed: number,
): LevelRecord | undefined {
  const solution = solveDesign(level, {
    timeLimitMs: proofMs,
    limits: { pathLimit: plan.chapter >= 5 ? 4 : 5 },
  });
  if (!solution.complete || solution.score < plan.minBest) {
    return undefined;
  }
  const baselines = strategyScores(level);
  if (!isAdmissible({ ...baselines, best: solution.score })) {
    return undefined;
  }
  if (plan.optional > 0 && solution.built.length === 0) {
    return undefined;
  }
  // Every situation after the quiet day has to have something going on
  if (
    level.situations.some((situation) => situation.id !== 'calm' && situation.events.length === 0)
  ) {
    return undefined;
  }
  const used = featuresUsed(solution.plan);
  if (plan.requires.some((rule) => rule !== 'queues' && !used[rule])) {
    return undefined;
  }
  const record: LevelRecord = {
    id: plan.id,
    chapter: plan.chapter,
    setting: plan.setting,
    seed,
    level: { ...level, id: plan.id },
    best: { plan: solution.plan, score: solution.score, built: solution.built },
    shortest: baselines.shortest,
    balanced: baselines.balanced,
    proof: { milliseconds: Math.round(solution.milliseconds), explored: solution.explored },
  };
  // In the chapter about queues the buffers have to change the result
  if (plan.requires.includes('queues') && queueGain(record) < QUEUE_GAIN) {
    return undefined;
  }
  return record;
}

function gapOf(record: LevelRecord): number {
  return record.best.score - Math.max(record.shortest, record.balanced);
}

describe('make the Backbone pool', () => {
  it('fills levels.json', async () => {
    if (resolveOnly) {
      const records = load(out);
      for (const plan of LEVEL_PLAN) {
        const old = records.find((record) => record.id === plan.id);
        if (old === undefined || (only !== undefined && !only.includes(plan.id))) {
          continue;
        }
        const next = proveRecord(plan, old.level, old.seed);
        if (next === undefined) {
          console.warn(`${plan.id}: fails a check with the new best plan, make it again`);
          continue;
        }
        console.warn(
          `${plan.id}: best ${old.best.score.toFixed(3)} -> ${next.best.score.toFixed(3)} (${String(next.proof.milliseconds)} ms)`,
        );
        records.splice(records.indexOf(old), 1, next);
        await save(records);
      }
      return;
    }
    if (join !== undefined) {
      const merged = new Map(load(out).map((record) => [record.id, record]));
      for (const file of join) {
        for (const record of load(resolve(file))) {
          merged.set(record.id, record);
        }
      }
      await save([...merged.values()]);
      return;
    }
    const records = load(out);
    for (const plan of LEVEL_PLAN) {
      if (only !== undefined && !only.includes(plan.id)) {
        continue;
      }
      if (!force && records.some((record) => record.id === plan.id)) {
        continue;
      }
      const found: LevelRecord[] = [];
      for (let number = 1; number <= MAX_SEEDS && found.length < candidateCount; number += 1) {
        const record = makeRecord(plan, number);
        if (record !== undefined) {
          found.push(record);
        }
      }
      const best = found.sort((a, b) => gapOf(b) - gapOf(a))[0];
      if (best === undefined) {
        console.warn(`${plan.id}: no level passed in ${String(MAX_SEEDS)} seeds`);
        continue;
      }
      const at = records.findIndex((record) => record.id === plan.id);
      if (at >= 0) {
        records.splice(at, 1);
      }
      records.push(best);
      console.warn(
        `${plan.id}: ${String(found.length)} candidates, kept gap ${gapOf(best).toFixed(3)} (${String(best.proof.milliseconds)} ms)`,
      );
      await save(records);
    }
  });
});
