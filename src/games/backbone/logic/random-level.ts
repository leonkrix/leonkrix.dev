import { createRandom, hashSeed } from '../../shared/random';
import { type LevelRecord } from '../data/pool';
import { dress, type SettingId, settings } from '../data/settings';
import { generateChecked, type LevelSpec } from './generate';
import { placeNames, tagConflicts } from './labels';
import { solveDesign } from './solver';
import { isAdmissible, strategyScores } from './stars';
import { type Job, type Tier, tiers } from './tiers';
import type { Rules } from './types';

/**
 * Random levels for the game: made in the browser from a tier and a seed, and only shown after the
 * best plan was proven and the level passed the same checks as the levels of the campaign (a
 * well formed drawing, room for the stars, a best plan that is nearly perfect on tiers where
 * nothing is lost by itself). The same seed gives the same level, so a level can be shared.
 */

const none: Rules = {
  split: false,
  backup: false,
  redundancy: false,
  throttle: false,
  stages: false,
  queues: false,
};

interface TierPlan {
  nodes: readonly number[];
  profiles: readonly (readonly LevelSpec['profiles'][number][])[];
  rules: Rules;
  situations: LevelSpec['situations'];
  pressure: number;
  lossyLinks: number;
  trap: number;
  minBest: number;
}

const PLANS: Readonly<Record<Tier, TierPlan>> = {
  1: {
    nodes: [6, 7],
    profiles: [
      ['web', 'web'],
      ['web', 'web', 'web'],
    ],
    rules: none,
    situations: ['calm'],
    pressure: 1.5,
    lossyLinks: 0,
    trap: 0.45,
    minBest: 0.999,
  },
  2: {
    nodes: [6, 7],
    profiles: [
      ['video', 'web'],
      ['video', 'web', 'web'],
    ],
    rules: { ...none, split: true },
    situations: ['calm', 'rush'],
    pressure: 1.5,
    lossyLinks: 0,
    trap: 0.3,
    minBest: 0.999,
  },
  3: {
    nodes: [7, 8],
    profiles: [
      ['voice', 'web', 'bulk'],
      ['voice', 'video', 'bulk'],
    ],
    rules: { ...none, split: true, throttle: true },
    situations: ['calm', 'rush'],
    pressure: 1.4,
    lossyLinks: 0,
    trap: 0,
    minBest: 0.75,
  },
  4: {
    nodes: [7, 8],
    profiles: [
      ['voice', 'web', 'transaction'],
      ['control', 'video', 'transaction'],
    ],
    rules: {
      split: true,
      throttle: true,
      backup: true,
      redundancy: true,
      stages: false,
      queues: true,
    },
    situations: ['calm', 'cut', 'rush'],
    pressure: 1.1,
    lossyLinks: 1,
    trap: 0,
    minBest: 0.85,
  },
  5: {
    nodes: [8, 9],
    profiles: [
      ['voice', 'video', 'web', 'transaction'],
      ['control', 'video', 'web', 'bulk'],
    ],
    rules: {
      split: true,
      throttle: true,
      backup: true,
      redundancy: true,
      stages: true,
      queues: true,
    },
    situations: ['calm', 'cut', 'lossy'],
    pressure: 1.1,
    lossyLinks: 1,
    trap: 0,
    minBest: 0.8,
  },
};

const SETTINGS: readonly SettingId[] = [
  'office',
  'hospital',
  'campus',
  'festival',
  'datacentre',
  'provider',
];

/** The description of the level that one seed makes on one tier. */
export function specFor(tier: Tier, seed: string): LevelSpec {
  const plan = PLANS[tier];
  const random = createRandom(`${seed}:spec`);
  return {
    seed: hashSeed(seed),
    nodes: random.pick(plan.nodes),
    family: random.pick(['grid', 'ring', 'hub', 'mesh'] as const),
    extraLinks: 0.4 + random.next() * 0.3,
    profiles: random.pick(plan.profiles),
    rules: plan.rules,
    situations: plan.situations,
    pressure: plan.pressure,
    lossyLinks: plan.lossyLinks,
    trap: plan.trap,
  };
}

/** What one seed makes, or `undefined` when it does not pass every check or takes too long. */
export function tryLevel(tier: Tier, seed: string, proofMs: number): LevelRecord | undefined {
  const plan = PLANS[tier];
  const spec = specFor(tier, seed);
  const { level: raw, problems } = generateChecked(spec);
  if (problems.length > 0) {
    return undefined;
  }
  const random = createRandom(`${seed}:setting`);
  const setting = random.pick(SETTINGS);
  const id = `random-${String(tier)}-${seed}`;
  const level = {
    ...dress(raw, setting),
    id,
    title: `Random level, ${tiers[tier - 1]?.name.toLowerCase() ?? ''}`,
    story: `A ${settings[setting].name.toLowerCase()} made just for you. Seed ${seed}.`,
  };
  const placement = placeNames(level);
  if (placement.conflicts > 0 || tagConflicts(level, placement) > 0) {
    return undefined;
  }
  const started = performance.now();
  const solution = solveDesign(level, {
    timeLimitMs: proofMs,
    limits: { pathLimit: tier >= 3 ? 4 : 5 },
  });
  if (!solution.complete || solution.score < plan.minBest) {
    return undefined;
  }
  const baselines = strategyScores(level);
  if (!isAdmissible({ ...baselines, best: solution.score })) {
    return undefined;
  }
  return {
    id,
    chapter: 0,
    setting,
    seed: spec.seed,
    level,
    best: { plan: solution.plan, score: solution.score, built: solution.built },
    shortest: baselines.shortest,
    balanced: baselines.balanced,
    proof: {
      milliseconds: Math.round(performance.now() - started),
      explored: solution.explored,
    },
  };
}

const MOST_ATTEMPTS = 400;

/**
 * Makes a level: tries `<seed>-1`, `<seed>-2` and so on until one passes. The record says which
 * seed worked, so that a shared link needs only that one.
 */
export function runJob(job: Job, proofMs = 3000): LevelRecord {
  if (job.exact === true) {
    const record = tryLevel(job.tier, job.seed, proofMs * 3);
    if (record === undefined) {
      throw new Error('That level cannot be made.');
    }
    return record;
  }
  for (let attempt = 1; attempt <= MOST_ATTEMPTS; attempt += 1) {
    const record = tryLevel(job.tier, `${job.seed}-${String(attempt)}`, proofMs);
    if (record !== undefined) {
      return record;
    }
  }
  throw new Error('No level could be made. Try again.');
}
