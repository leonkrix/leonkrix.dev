import { type Random } from '../../shared/random';
import { minRoomsOf } from '../data/pool-plan';
import { skins } from '../data/skins';
import { type LevelRecord } from '../pool';
import { generateLevel, problemsOf } from './generator';
import { type Tier } from './types';

/** The sizes a random level can have in a tier. Easy puzzles on a big map are too rare to wait for. */
export const RANDOM_SIZES: Readonly<Record<Tier, readonly [number, number]>> = {
  easy: [4, 7],
  medium: [5, 9],
  hard: [6, 9],
};

/** What the player asks for. "any" leaves the choice to chance. */
export interface RandomSetup {
  tier: Tier | 'any';
  size: number | 'any';
}

/** Everything a worker needs to make one level */
export interface Job {
  skin: 'case-file' | 'outage';
  tier: Tier;
  size: number;
  victimRole: string;
  /** The first seed to try. A worker tries `<seed>`, `<seed>-2`, `<seed>-3` and so on. */
  seed: string;
}

const TIERS: readonly Tier[] = ['easy', 'medium', 'hard'];

/** Sizes that are possible for a tier, or for any tier */
export function sizesFor(tier: Tier | 'any'): readonly number[] {
  const [low, high] = tier === 'any' ? [4, 9] : RANDOM_SIZES[tier];
  return Array.from({ length: high - low + 1 }, (_, index) => low + index);
}

/** Turns the wishes of the player into one exact kind of level. */
export function chooseJob(setup: RandomSetup, random: Random, seed: string): Job {
  const tier = setup.tier === 'any' ? random.pick(TIERS) : setup.tier;
  const [low, high] = RANDOM_SIZES[tier];
  const wanted = setup.size === 'any' ? undefined : setup.size;
  const size =
    wanted !== undefined && wanted >= low && wanted <= high
      ? wanted
      : low + random.int(high - low + 1);
  const skin = random.pick(['case-file', 'outage'] as const);
  const victimRole = random.pick(skins[skin].victimRoles);
  return { skin, tier, size, victimRole, seed };
}

/**
 * About how long one worker needs for a level, in milliseconds, measured on a laptop and made
 * longer for slower devices. It only drives the progress bar: the real time is a matter of chance
 * (a map either gives a puzzle or does not), so the bar is an estimate and says so.
 */
const TYPICAL_MS: Readonly<Record<string, number>> = {
  'easy-4': 40,
  'easy-5': 100,
  'easy-6': 1000,
  'easy-7': 4000,
  'medium-5': 100,
  'medium-6': 500,
  'medium-7': 2000,
  'medium-8': 4000,
  'medium-9': 15000,
  'hard-6': 1700,
  'hard-7': 5500,
  'hard-8': 11000,
  'hard-9': 30000,
};

export function typicalMilliseconds(tier: Tier, size: number): number {
  return TYPICAL_MS[`${tier}-${String(size)}`] ?? 5000;
}

/**
 * Makes a level for a job: tries one seed after the other until a puzzle passes every check (both
 * solvers find exactly the stored solution) and the map has enough rooms. It stops only when it
 * has one, so a caller that wants to cancel stops the thread that runs it.
 */
export function runJob(job: Job, attemptsPerSeed = 200): LevelRecord {
  const skin = skins[job.skin];
  for (let number = 1; ; number += 1) {
    const seed = number === 1 ? job.seed : `${job.seed}-${String(number)}`;
    const made = generateLevel(skin, job.size, job.tier, seed, {
      maxAttempts: attemptsPerSeed,
      victimRole: job.victimRole,
    });
    if (made === undefined || made.level.layout.roomCount < minRoomsOf(job.size)) {
      continue;
    }
    if (problemsOf(made.level).length > 0) {
      continue;
    }
    const { layout, people, clues, solution } = made.level;
    return {
      id: `random-${seed}`,
      skin: job.skin,
      tier: job.tier,
      size: job.size,
      seed,
      layout,
      people: [...people],
      clues: [...clues],
      solution: [...solution],
    };
  }
}
