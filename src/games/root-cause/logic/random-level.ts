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
 * The address query that makes the very same random level again: the seed with what the seed was
 * used for. Everything is public text and nothing personal. A level is only the same again while
 * the generator is the same, so a link may give another (equally good) level after an update.
 */
export function shareQuery(record: LevelRecord): string {
  const victim = record.people.at(-1)?.role ?? '';
  const query = new URLSearchParams({
    level: 'random',
    seed: record.seed,
    tier: record.tier,
    size: String(record.size),
    skin: record.skin,
    victim,
  });
  return `?${query.toString()}`;
}

/** The job in an address query made by `shareQuery`, or nothing if it is not one or not valid. */
export function jobFromQuery(search: string): Job | undefined {
  const query = new URLSearchParams(search);
  if (query.get('level') !== 'random') {
    return undefined;
  }
  const seed = query.get('seed') ?? '';
  const tier = TIERS.find((entry) => entry === query.get('tier'));
  const skin = (['case-file', 'outage'] as const).find((entry) => entry === query.get('skin'));
  const size = Number(query.get('size'));
  const victimRole = query.get('victim') ?? '';
  if (
    !/^[a-z0-9-]{1,60}$/.test(seed) ||
    tier === undefined ||
    skin === undefined ||
    !Number.isInteger(size) ||
    size < 4 ||
    size > 9 ||
    !skins[skin].victimRoles.includes(victimRole)
  ) {
    return undefined;
  }
  return { skin, tier, size, victimRole, seed };
}

/**
 * About how long one worker needs for a level, in milliseconds: the median of 12 to 16 levels per
 * size and tier made one after the other on a laptop (2026-10-10, the generator with objects
 * placed room by room). It only drives the progress bar: the real time is a matter of chance (a
 * map either gives a puzzle or does not, and now and then it takes ten times as long), so the bar
 * is an estimate and says so. A hard 9 by 9 is a median of 10 s but a mean of 40 s.
 */
const TYPICAL_MS: Readonly<Record<string, number>> = {
  'easy-4': 20,
  'easy-5': 45,
  'easy-6': 300,
  'easy-7': 800,
  'medium-5': 100,
  'medium-6': 250,
  'medium-7': 700,
  'medium-8': 2300,
  'medium-9': 9900,
  'hard-6': 650,
  'hard-7': 3000,
  'hard-8': 15700,
  'hard-9': 15000,
};

/**
 * How long a level takes, about, with this many threads trying at once: the first one to finish
 * wins, which helps a lot but not four times as much (measured: 4 threads need about a third).
 */
export function typicalMilliseconds(tier: Tier, size: number, workers = 1): number {
  const single = TYPICAL_MS[`${tier}-${String(size)}`] ?? 5000;
  return Math.round(single * Math.max(1, workers) ** -0.8);
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
