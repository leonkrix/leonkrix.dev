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
 *
 * For an even mix of clues over the whole pool, make several candidates per level and let the
 * script choose (see `logic/balance.ts`):
 *   LEVELS_CANDIDATES=5 LEVELS_OUT=candidates-hard.json LEVELS=hard-5 pnpm levels
 *       writes 5 candidates of every level to a file (run several in parallel)
 *   LEVELS_SELECT=candidates-a.json,candidates-b.json pnpm levels
 *       reads candidate files, chooses one level of each id and writes the pool
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { format, resolveConfig } from 'prettier';
import { describe, it } from 'vitest';

import { LEVEL_PLAN, minRoomsOf } from '../src/games/root-cause/data/pool-plan';
import { skins } from '../src/games/root-cause/data/skins';
import { chooseBalanced, clueKindsOf, imbalance } from '../src/games/root-cause/logic/balance';
import { generateLevel, problemsOf } from '../src/games/root-cause/logic/generator';
import { type LevelRecord } from '../src/games/root-cause/pool';

const DEFAULT_OUT = 'src/games/root-cause/data/levels.json';
const out = resolve(process.env.LEVELS_OUT ?? DEFAULT_OUT);
const only = process.env.LEVELS?.split(',').filter((id) => id !== '');
const force = process.env.LEVELS_FORCE === '1';
const candidateCount = Number(process.env.LEVELS_CANDIDATES ?? '0');
const selectFrom = process.env.LEVELS_SELECT?.split(',').filter((file) => file !== '');

function load(): LevelRecord[] {
  return existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as LevelRecord[]) : [];
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
}

/** The next level that passes every check for a plan, trying seeds from the number given on */
function nextLevel(
  plan: (typeof LEVEL_PLAN)[number],
  from: number,
): { record: LevelRecord; number: number } {
  for (let number = from; ; number += 1) {
    const seed = `${plan.id}-${String(number)}`;
    const made = generateLevel(skins[plan.skin], plan.size, plan.tier, seed, {
      victimRole: plan.victim,
    });
    if (made === undefined || made.level.layout.roomCount < minRoomsOf(plan.size)) {
      continue;
    }
    const problems = problemsOf(made.level);
    if (problems.length > 0) {
      console.warn(`${seed}: rejected: ${problems.join('; ')}`);
      continue;
    }
    const { layout, people, clues, solution } = made.level;
    return {
      number,
      record: {
        id: plan.id,
        skin: plan.skin,
        tier: plan.tier,
        size: plan.size,
        seed,
        layout,
        people: [...people],
        clues: [...clues],
        solution: [...solution],
      },
    };
  }
}

if (selectFrom !== undefined) {
  describe('choose the Root Cause level pool from candidates', () => {
    it('chooses an even mix', async () => {
      const candidates = new Map<string, LevelRecord[]>();
      for (const file of selectFrom) {
        const found = JSON.parse(readFileSync(resolve(file), 'utf8')) as Record<
          string,
          LevelRecord[]
        >;
        for (const [id, list] of Object.entries(found)) {
          candidates.set(id, [...(candidates.get(id) ?? []), ...list]);
        }
      }
      // In the order of the plan, so that the result does not depend on the order of the files
      const ordered = new Map(
        LEVEL_PLAN.flatMap((plan) => {
          const list = candidates.get(plan.id);
          return list === undefined ? [] : [[plan.id, list] as const];
        }),
      );
      const chosen = [...chooseBalanced(ordered).values()];
      const first = [...ordered.values()]
        .map((list) => list[0])
        .filter((entry) => entry !== undefined);
      console.warn(
        `uneven: ${String(imbalance(first))} with the first candidates, ${String(imbalance(chosen))} chosen`,
      );
      const kinds = new Map<string, number>();
      for (const record of chosen) {
        for (const kind of clueKindsOf(record.clues)) {
          kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
        }
      }
      console.warn(
        [...kinds.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([kind, count]) => `${kind}:${String(count)}`)
          .join(' '),
      );
      await save(chosen);
    });
  });
} else if (candidateCount > 0) {
  describe('make candidates for the Root Cause level pool', () => {
    for (const plan of LEVEL_PLAN) {
      if (only !== undefined && !only.includes(plan.id)) {
        continue;
      }
      it(plan.id, async () => {
        const list: LevelRecord[] = [];
        for (let number = 1; list.length < candidateCount;) {
          const found = nextLevel(plan, number);
          list.push(found.record);
          number = found.number + 1;
        }
        const file = existsSync(out)
          ? (JSON.parse(readFileSync(out, 'utf8')) as Record<string, LevelRecord[]>)
          : {};
        await write(out, { ...file, [plan.id]: list });
      });
    }
  });
} else {
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
        const { record } = nextLevel(plan, 1);
        await save([...load().filter((other) => other.id !== plan.id), record]);
        console.warn(
          `${plan.id}: seed ${record.seed}, ${String(record.clues.length)} clues, ` +
            `${String(Math.round((Date.now() - started) / 1000))} s`,
        );
      });
    }
  });
}
