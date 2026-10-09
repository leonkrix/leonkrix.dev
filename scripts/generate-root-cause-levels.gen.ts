/**
 * Makes the level pool of Root Cause (`src/games/root-cause/data/levels.json`).
 *
 * Run it with `pnpm levels`. Levels that are in the file already are kept (they are only made
 * again with LEVELS_FORCE=1), so the file changes only when you ask for it. Useful settings:
 *   LEVELS=easy-1,hard-5   only these levels
 *   LEVELS_OUT=file.json   write to another file (to make several levels in parallel)
 *   LEVELS_FORCE=1         make levels again even if they exist
 * Each level tries seeds "<id>-1", "<id>-2", ... until the generator finds a puzzle that both
 * solvers verify. The seed that worked is stored with the level.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { format, resolveConfig } from 'prettier';
import { describe, it } from 'vitest';

import { LEVEL_PLAN, minRoomsOf } from '../src/games/root-cause/data/pool-plan';
import { skins } from '../src/games/root-cause/data/skins';
import { generateLevel, problemsOf } from '../src/games/root-cause/logic/generator';
import { type LevelRecord } from '../src/games/root-cause/pool';

const DEFAULT_OUT = 'src/games/root-cause/data/levels.json';
const out = resolve(process.env.LEVELS_OUT ?? DEFAULT_OUT);
const only = process.env.LEVELS?.split(',').filter((id) => id !== '');
const force = process.env.LEVELS_FORCE === '1';

function load(): LevelRecord[] {
  return existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as LevelRecord[]) : [];
}

/** Writes the file the way Prettier formats JSON, so that the format check passes */
async function save(records: LevelRecord[]): Promise<void> {
  const order = LEVEL_PLAN.map((plan) => plan.id);
  records.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const options = await resolveConfig(out);
  writeFileSync(out, await format(JSON.stringify(records), { ...options, filepath: out }));
}

describe('generate the Root Cause level pool', () => {
  for (const plan of LEVEL_PLAN) {
    if (only !== undefined && !only.includes(plan.id)) {
      continue;
    }
    it(plan.id, async () => {
      if (!force && load().some((record) => record.id === plan.id)) {
        console.warn(`${plan.id}: exists, kept`);
        return;
      }
      const started = Date.now();
      for (let number = 1; ; number += 1) {
        const seed = `${plan.id}-${String(number)}`;
        const made = generateLevel(skins[plan.skin], plan.size, plan.tier, seed, {
          victimRole: plan.victim,
        });
        if (made === undefined) {
          continue;
        }
        if (made.level.layout.roomCount < minRoomsOf(plan.size)) {
          continue;
        }
        const problems = problemsOf(made.level);
        if (problems.length > 0) {
          console.warn(`${seed}: rejected: ${problems.join('; ')}`);
          continue;
        }
        const { layout, people, clues, solution } = made.level;
        const record: LevelRecord = {
          id: plan.id,
          skin: plan.skin,
          tier: plan.tier,
          size: plan.size,
          seed,
          layout,
          people: [...people],
          clues: [...clues],
          solution: [...solution],
        };
        await save([...load().filter((other) => other.id !== plan.id), record]);
        console.warn(
          `${plan.id}: seed ${seed}, ${String(clues.length)} clues, ` +
            `${String(Math.round((Date.now() - started) / 1000))} s`,
        );
        return;
      }
    });
  }
});
