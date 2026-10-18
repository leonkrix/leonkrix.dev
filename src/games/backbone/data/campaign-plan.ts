import type { Family, LevelSpec, SituationKind } from '../logic/generate';
import type { ProfileId, Rules } from '../logic/types';
import type { SettingId } from './settings';

/**
 * The campaign: chapters, each with one new rule, and the levels of each chapter. The generator
 * script (`pnpm levels-backbone`) searches a seed for every level of this plan, proves the best
 * plan and stores the result in `levels.json`. The tests check the pool against this plan.
 */

export interface Chapter {
  number: number;
  title: string;
  /** What is new in this chapter, one or two sentences */
  rule: string;
}

export interface LevelPlan {
  id: string;
  chapter: number;
  setting: SettingId;
  title: string;
  /** A few lines of what is going on */
  story: string;
  nodes: number;
  family: Family;
  /** Links beyond the minimum, as a share of the number of nodes */
  extraLinks: number;
  profiles: readonly ProfileId[];
  situations: readonly SituationKind[];
  pressure: number;
  lossyLinks: number;
  /**
   * The least the best plan has to score. In the first chapters it is (nearly) 100: everything fits
   * if it is routed well, and what is lost is the player's doing. Later chapters have losses that
   * nobody can avoid (a cut cable, a link that drops packets, bulk traffic that is held back).
   */
  minBest: number;
  /** See `LevelSpec.trap` */
  trap: number;
  /** How many cables are optional and cost money (chapter 7) */
  optional: number;
  /** Zones and a firewall (chapter 10) */
  zones: boolean;
  /** Options the best plan has to use, so that the new rule of the chapter matters in the level */
  requires: readonly (keyof Rules)[];
}

const none: Rules = {
  split: false,
  backup: false,
  redundancy: false,
  throttle: false,
  stages: false,
};

/** The rules of a chapter: everything that came before plus the new one. */
export const chapterRules: Readonly<Record<number, Rules>> = {
  1: none,
  2: none,
  3: { ...none, split: true },
  4: { ...none, split: true },
  5: { ...none, split: true, throttle: true },
  6: { ...none, split: true, throttle: true, backup: true },
  7: { ...none, split: true, throttle: true, backup: true },
  8: { ...none, split: true, throttle: true, backup: true, redundancy: true },
  9: { split: true, throttle: true, backup: true, redundancy: true, stages: true },
  10: { split: true, throttle: true, backup: true, redundancy: true, stages: true },
  11: { split: true, throttle: true, backup: true, redundancy: true, stages: true },
};

export const chapters: readonly Chapter[] = [
  {
    number: 1,
    title: 'First packets',
    rule: 'Every link carries only so much. Send each flow along a path and keep the traffic under the capacity, or the rest is dropped.',
  },
  {
    number: 2,
    title: 'Sharing',
    rule: 'Flows share links. When two of them want the same cable, one of them has to take another way.',
  },
  {
    number: 3,
    title: 'Splitting',
    rule: 'One flow can use several paths at once. Split it in quarters to fill the roads that are free.',
  },
  {
    number: 4,
    title: 'Latency',
    rule: 'Voice must arrive fast. The shortest path on the map is not always the fastest one when it is full.',
  },
  {
    number: 5,
    title: 'Priorities',
    rule: 'On a full link, voice goes first and bulk goes last. Hold bulk traffic back to make room for what matters.',
  },
  {
    number: 6,
    title: 'When things break',
    rule: 'A cable will be cut. Give a flow a backup path and it switches at once; without one it is lost for a while.',
  },
  {
    number: 7,
    title: 'Budget',
    rule: 'Some cables do not exist yet. Build the ones that matter within the budget, then route the traffic over what you built.',
  },
  {
    number: 8,
    title: 'Loss',
    rule: 'Some links lose packets. Redundancy sends extra coded packets to recover them, but they use capacity too.',
  },
  {
    number: 9,
    title: 'On the move',
    rule: 'Links come and go. Plan a change of path for the moment a link appears or disappears.',
  },
  {
    number: 10,
    title: 'Zones',
    rule: 'Guests may not talk to the servers directly. Their traffic has to pass the firewall, so the shortest path is no longer allowed.',
  },
  {
    number: 11,
    title: 'Everything',
    rule: 'All of it at once, in bigger networks, with more than one bad day to survive.',
  },
];

/** See `LevelPlan.minBest`, by chapter */
const MIN_BEST: Readonly<Record<number, number>> = {
  1: 0.999,
  2: 0.999,
  3: 0.999,
  4: 0.96,
  5: 0.75,
  6: 0.9,
  7: 0.97,
  8: 0.85,
  9: 0.8,
  10: 0.8,
  11: 0.8,
};

function level(
  id: string,
  setting: SettingId,
  title: string,
  story: string,
  shape: Pick<LevelPlan, 'nodes' | 'family' | 'profiles' | 'situations'> &
    Partial<
      Pick<
        LevelPlan,
        | 'extraLinks'
        | 'pressure'
        | 'lossyLinks'
        | 'requires'
        | 'trap'
        | 'minBest'
        | 'zones'
        | 'optional'
      >
    >,
): LevelPlan {
  return {
    id,
    chapter: Number(/^c(\d+)-/.exec(id)?.[1] ?? 0),
    setting,
    title,
    story,
    extraLinks: 0.5,
    pressure: 1.4,
    lossyLinks: 0,
    minBest: MIN_BEST[Number(/^c(\d+)-/.exec(id)?.[1] ?? 0)] ?? 0.8,
    zones: false,
    optional: 0,
    trap: Number(/^c(\d+)-/.exec(id)?.[1] ?? 0) <= 2 ? 0.45 : 0,
    requires: [],
    ...shape,
  };
}

export const LEVEL_PLAN: readonly LevelPlan[] = [
  // 1. First packets: one rule, a few flows, nothing else.
  level(
    'c1-1',
    'office',
    'The new printer',
    'A new floor, a new cable, and two teams want the shared drive at once.',
    {
      nodes: 6,
      family: 'ring',
      profiles: ['web', 'web'],
      situations: ['calm'],
      pressure: 1.5,
    },
  ),
  level(
    'c1-2',
    'office',
    'Monday morning',
    'Everyone logs in at nine. The cable to the file server was not made for that.',
    {
      nodes: 6,
      family: 'grid',
      profiles: ['web', 'web'],
      situations: ['calm'],
      pressure: 1.5,
    },
  ),
  level(
    'c1-3',
    'campus',
    'Exam week',
    'Three halls upload at the same time. Find each of them a road.',
    {
      nodes: 6,
      family: 'mesh',
      profiles: ['web', 'web', 'web'],
      situations: ['calm'],
      pressure: 1.5,
    },
  ),
  level(
    'c1-4',
    'office',
    'Open plan',
    'More desks than cables. Somebody has to take the long way round.',
    {
      nodes: 7,
      family: 'grid',
      profiles: ['web', 'web', 'web'],
      situations: ['calm'],
      pressure: 1.6,
    },
  ),
  // 2. Sharing
  level(
    'c2-1',
    'hospital',
    'Morning rounds',
    'Records and lab results want the same corridor. Keep both moving.',
    {
      nodes: 7,
      family: 'mesh',
      profiles: ['web', 'video', 'web'],
      situations: ['calm'],
      pressure: 1.5,
    },
  ),
  level(
    'c2-2',
    'campus',
    'Lecture night',
    'A live lecture, a downloaded course and a hundred students on the web.',
    {
      nodes: 8,
      family: 'grid',
      profiles: ['video', 'web', 'web', 'video'],
      situations: ['calm'],
      pressure: 1.5,
    },
  ),
  level(
    'c2-3',
    'festival',
    'Gates open',
    'Ticket scans, a live stream and a social wall, all on a field of cables.',
    {
      nodes: 8,
      family: 'hub',
      profiles: ['web', 'video', 'web', 'video'],
      situations: ['calm'],
      pressure: 1.6,
    },
  ),
  level(
    'c2-4',
    'provider',
    'Prime time',
    'Everybody streams at eight. The metro ring is where it hurts.',
    {
      nodes: 9,
      family: 'ring',
      profiles: ['video', 'video', 'web', 'web'],
      situations: ['calm', 'rush'],
      pressure: 1.4,
    },
  ),
  // 3. Splitting
  level(
    'c3-1',
    'datacentre',
    'Two roads',
    'One big transfer and two cables that are each too small. Use both.',
    {
      nodes: 6,
      family: 'ring',
      profiles: ['video', 'web'],
      situations: ['calm'],
      pressure: 1.6,
      requires: ['split'],
    },
  ),
  level(
    'c3-2',
    'festival',
    'Main stage',
    'The live stream is bigger than any single cable on the field.',
    {
      nodes: 7,
      family: 'hub',
      profiles: ['video', 'web', 'web'],
      situations: ['calm'],
      pressure: 1.6,
      requires: ['split'],
    },
  ),
  level('c3-3', 'campus', 'Open day', 'Video, mail and the web portal share a cramped campus.', {
    nodes: 8,
    family: 'mesh',
    profiles: ['video', 'web', 'video'],
    situations: ['calm', 'rush'],
    pressure: 1.4,
    requires: ['split'],
  }),
  level(
    'c3-4',
    'provider',
    'Cup final',
    'The whole region watches the same match. Spread it over the ring.',
    {
      nodes: 9,
      family: 'ring',
      profiles: ['video', 'video', 'web', 'web'],
      situations: ['calm', 'rush'],
      pressure: 1.4,
      requires: ['split'],
    },
  ),
  // 4. Latency
  level(
    'c4-1',
    'office',
    'The long call',
    'Calls crackle when they take the busy road. Keep voice on a quick path.',
    {
      nodes: 7,
      family: 'grid',
      profiles: ['voice', 'web', 'web'],
      situations: ['calm'],
      pressure: 1.5,
    },
  ),
  level(
    'c4-2',
    'hospital',
    'Nurse call',
    'The call system must be fast; the record system can wait a moment.',
    {
      nodes: 8,
      family: 'mesh',
      profiles: ['voice', 'web', 'video'],
      situations: ['calm', 'rush'],
      pressure: 1.4,
    },
  ),
  level(
    'c4-3',
    'festival',
    'Crew radio',
    'Crew calls must reach the stage manager while the stream is at its peak.',
    {
      nodes: 8,
      family: 'hub',
      profiles: ['voice', 'voice', 'video', 'web'],
      situations: ['calm', 'rush'],
      pressure: 1.4,
    },
  ),
  level(
    'c4-4',
    'datacentre',
    'On-call',
    'The ops bridge must stay clear while the build farm pushes out artifacts.',
    {
      nodes: 9,
      family: 'grid',
      profiles: ['voice', 'video', 'web', 'web'],
      situations: ['calm', 'rush'],
      pressure: 1.4,
    },
  ),
  // 5. Priorities
  level(
    'c5-1',
    'office',
    'Backup night',
    'The nightly backup wants every cable. Let it have what is left.',
    {
      nodes: 7,
      family: 'mesh',
      profiles: ['voice', 'web', 'bulk'],
      situations: ['calm'],
      pressure: 1.5,
      requires: ['throttle'],
    },
  ),
  level(
    'c5-2',
    'hospital',
    'Scan archive',
    'The imaging archive is huge and patient monitors are not.',
    {
      nodes: 7,
      family: 'mesh',
      profiles: ['voice', 'bulk', 'web'],
      situations: ['calm'],
      pressure: 1.7,
      requires: ['throttle'],
    },
  ),
  level(
    'c5-3',
    'datacentre',
    'Batch window',
    'Two bulk jobs, a web tier and a bridge call share the spine.',
    {
      nodes: 8,
      family: 'grid',
      profiles: ['voice', 'web', 'bulk', 'bulk'],
      situations: ['calm', 'rush'],
      pressure: 1.5,
      requires: ['throttle'],
    },
  ),
  level(
    'c5-4',
    'campus',
    'Mirror sync',
    'The software mirror syncs at the worst hour. Slow it down, not the exams.',
    {
      nodes: 9,
      family: 'mesh',
      profiles: ['voice', 'video', 'web', 'bulk'],
      situations: ['calm', 'rush'],
      pressure: 1.5,
      requires: ['throttle'],
    },
  ),
  // 6. When things break
  level(
    'c6-1',
    'office',
    'The cut cable',
    'A builder digs through a cable. Give the important flow a way around.',
    {
      nodes: 6,
      family: 'ring',
      profiles: ['web', 'voice'],
      situations: ['calm', 'cut'],
      pressure: 1.1,
      requires: ['backup'],
    },
  ),
  level(
    'c6-2',
    'hospital',
    'Night shift',
    'A link goes down at three in the morning. Monitors must not notice.',
    {
      nodes: 7,
      family: 'mesh',
      profiles: ['voice', 'web', 'video'],
      situations: ['calm', 'cut'],
      pressure: 1.2,
      requires: ['backup'],
    },
  ),
  level(
    'c6-3',
    'provider',
    'Storm',
    'Wind takes down a metro link. Customers should hardly notice.',
    {
      nodes: 8,
      family: 'ring',
      profiles: ['voice', 'video', 'web', 'web'],
      situations: ['calm', 'cut'],
      pressure: 1.2,
      requires: ['backup'],
    },
  ),
  level(
    'c6-4',
    'datacentre',
    'Pulled plug',
    'Somebody pulls the wrong cable. The cluster has seconds to react.',
    {
      nodes: 9,
      family: 'grid',
      profiles: ['voice', 'web', 'video', 'bulk'],
      situations: ['calm', 'rush', 'cut'],
      pressure: 1.2,
      requires: ['backup'],
    },
  ),
  // 7. Budget: some cables are optional and cost money
  level(
    'c7-1',
    'office',
    'The new wing',
    'Two cables could connect the new wing. The budget pays for one.',
    {
      nodes: 6,
      family: 'grid',
      profiles: ['web', 'web', 'video'],
      situations: ['calm'],
      pressure: 1.2,
      optional: 3,
    },
  ),
  level(
    'c7-2',
    'campus',
    'Summer upgrade',
    'A summer to rebuild the campus network, with money for part of the plan.',
    {
      nodes: 8,
      family: 'mesh',
      profiles: ['video', 'web', 'web', 'voice'],
      situations: ['calm'],
      pressure: 1.2,
      optional: 4,
    },
  ),
  level(
    'c7-3',
    'provider',
    'New ring',
    'Close the ring in the north, or lay a shortcut across the lake. Not both.',
    {
      nodes: 9,
      family: 'ring',
      profiles: ['video', 'video', 'web', 'transaction'],
      situations: ['calm', 'rush'],
      pressure: 1.2,
      optional: 4,
    },
  ),
  level(
    'c7-4',
    'festival',
    'Pop-up network',
    'Three days, a field and a budget. Lay the cables that the crowd will need.',
    {
      nodes: 9,
      family: 'hub',
      profiles: ['voice', 'video', 'web', 'bulk'],
      situations: ['calm', 'rush'],
      pressure: 1.2,
      optional: 5,
    },
  ),
  // 8. Loss
  level(
    'c8-1',
    'provider',
    'Wet cable',
    'One link drops packets whenever it rains. Pay a little to be safe.',
    {
      nodes: 6,
      family: 'ring',
      profiles: ['transaction', 'web'],
      situations: ['calm', 'lossy'],
      pressure: 1.0,
      lossyLinks: 1,
      requires: ['redundancy'],
    },
  ),
  level(
    'c8-2',
    'office',
    'Payday',
    'Payroll cannot lose a single packet. Everything else can lose a few.',
    {
      nodes: 7,
      family: 'mesh',
      profiles: ['transaction', 'video', 'web'],
      situations: ['calm', 'lossy'],
      pressure: 1.0,
      lossyLinks: 2,
      requires: ['redundancy'],
    },
  ),
  level(
    'c8-3',
    'drones',
    'Over the ridge',
    'Radio links flicker. Commands must arrive, video may stutter.',
    {
      nodes: 8,
      family: 'mesh',
      profiles: ['control', 'video', 'web', 'transaction'],
      situations: ['calm', 'lossy'],
      pressure: 1.0,
      lossyLinks: 2,
      requires: ['redundancy'],
    },
  ),
  level(
    'c8-4',
    'hospital',
    'Telemetry',
    'Ventilator data and imaging cross a noisy wing. Protect the right one.',
    {
      nodes: 9,
      family: 'grid',
      profiles: ['control', 'transaction', 'video', 'bulk'],
      situations: ['calm', 'lossy', 'cut'],
      pressure: 1.0,
      lossyLinks: 2,
      requires: ['redundancy'],
    },
  ),
  // 9. On the move
  level(
    'c9-1',
    'drones',
    'Passing relay',
    'A relay drifts out of range while another comes into range. Switch in time.',
    {
      nodes: 6,
      family: 'mesh',
      profiles: ['control', 'video'],
      situations: ['calm', 'moving'],
      pressure: 1.1,
      requires: ['stages'],
    },
  ),
  level(
    'c9-2',
    'drones',
    'Search pattern',
    'The swarm sweeps a valley. Links open and close as it moves.',
    {
      nodes: 8,
      family: 'mesh',
      profiles: ['control', 'video', 'web'],
      situations: ['calm', 'moving'],
      pressure: 1.1,
      requires: ['stages'],
    },
  ),
  level(
    'c9-3',
    'festival',
    'Parade',
    'The parade carries its own camera and radio, and the field links come and go.',
    {
      nodes: 8,
      family: 'hub',
      profiles: ['voice', 'video', 'transaction'],
      situations: ['calm', 'moving'],
      pressure: 1.1,
      requires: ['stages'],
    },
  ),
  // 10. Zones: guests may not reach the servers except through the firewall
  level(
    'c10-1',
    'office',
    'Guest wifi',
    'Visitors may use the web, but never talk to the file server directly. Everything goes through the firewall.',
    {
      nodes: 7,
      family: 'grid',
      profiles: ['web', 'web', 'video'],
      situations: ['calm'],
      pressure: 1.2,
      zones: true,
    },
  ),
  level(
    'c10-2',
    'hospital',
    'Visitors and patients',
    'Visitors, staff and the record system share one network. The firewall decides who passes.',
    {
      nodes: 9,
      family: 'mesh',
      profiles: ['voice', 'web', 'video', 'transaction'],
      situations: ['calm', 'rush'],
      pressure: 1.2,
      zones: true,
    },
  ),
  level(
    'c10-3',
    'campus',
    'The open lab',
    'Students bring their own devices. Research data stays behind the firewall, and the firewall has only so much capacity.',
    {
      nodes: 10,
      family: 'grid',
      profiles: ['voice', 'video', 'web', 'transaction'],
      situations: ['calm', 'rush', 'cut'],
      pressure: 1.2,
      zones: true,
    },
  ),
  // 11. Everything
  level('c11-1', 'campus', 'The big day', 'Enrolment, an open day and a storm in the same week.', {
    nodes: 10,
    family: 'mesh',
    profiles: ['voice', 'video', 'web', 'transaction', 'bulk'],
    situations: ['calm', 'rush', 'cut'],
    pressure: 1.2,
  }),
  level(
    'c11-2',
    'provider',
    'Black Friday',
    'Payments, streams and a storm that cuts the coast road.',
    {
      nodes: 11,
      family: 'ring',
      profiles: ['voice', 'video', 'web', 'transaction', 'bulk'],
      situations: ['calm', 'rush', 'cut'],
      pressure: 1.2,
    },
  ),
  level(
    'c11-3',
    'drones',
    'Rescue',
    'Control, camera and a map for the rescue team, over links that come and go.',
    {
      nodes: 11,
      family: 'mesh',
      profiles: ['control', 'video', 'web', 'transaction', 'bulk'],
      situations: ['calm', 'moving', 'lossy'],
      pressure: 1.1,
      lossyLinks: 2,
    },
  ),
];

/** The spec the generator uses for a planned level and a seed. */
export function specOf(plan: LevelPlan, seed: number): LevelSpec {
  return {
    seed,
    nodes: plan.nodes,
    family: plan.family,
    extraLinks: plan.extraLinks,
    profiles: plan.profiles,
    rules: chapterRules[plan.chapter] ?? none,
    situations: plan.situations,
    pressure: plan.pressure,
    lossyLinks: plan.lossyLinks,
    trap: plan.trap,
    zones: plan.zones,
    optional: plan.optional,
    title: plan.title,
    story: plan.story,
  };
}
