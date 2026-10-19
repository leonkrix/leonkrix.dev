import type { Family, LevelSpec, SituationKind } from '../logic/generate';
import type { ProfileId, Rules } from '../logic/types';
export { type Chapter, chapters } from './chapters';
import type { SettingId } from './settings';

/**
 * The campaign: 13 chapters, each with one new rule, and six levels in each. The generator script
 * (`pnpm levels-backbone`) searches a seed for every level of this plan, proves the best plan and
 * stores the result in `levels.json`. The tests check the pool against this plan.
 */

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
  /** How many cables are optional and cost money (chapter 8) */
  optional: number;
  /** Zones and a firewall (chapter 11) */
  zones: boolean;
  /**
   * What has to matter in the level, so that the new rule of the chapter is not decoration: the
   * options that the best plan uses, or, for `queues`, that the buffers change the score.
   */
  requires: readonly (keyof Rules)[];
}

const none: Rules = {
  split: false,
  backup: false,
  redundancy: false,
  throttle: false,
  stages: false,
  queues: false,
};

const all: Rules = {
  split: true,
  throttle: true,
  queues: true,
  backup: true,
  redundancy: true,
  stages: true,
};

/** The rules of a chapter: everything that came before plus the new one. */
export const chapterRules: Readonly<Record<number, Rules>> = {
  1: none,
  2: none,
  3: { ...none, split: true },
  4: { ...none, split: true },
  5: { ...none, split: true, throttle: true },
  6: { ...none, split: true, throttle: true, queues: true },
  7: { ...none, split: true, throttle: true, queues: true, backup: true },
  8: { ...none, split: true, throttle: true, queues: true, backup: true },
  9: { ...none, split: true, throttle: true, queues: true, backup: true, redundancy: true },
  10: all,
  11: all,
  12: all,
  13: all,
};

/** See `LevelPlan.minBest`, by chapter */
const MIN_BEST: Readonly<Record<number, number>> = {
  1: 0.999,
  2: 0.999,
  3: 0.999,
  4: 0.96,
  5: 0.75,
  6: 0.8,
  7: 0.9,
  8: 0.97,
  9: 0.85,
  10: 0.8,
  11: 0.8,
  12: 0.7,
  13: 0.7,
};

/** What a chapter's levels have in common. A row can say otherwise. */
interface ChapterDefaults {
  pressure: number;
  trap: number;
  requires: readonly (keyof Rules)[];
  lossyLinks: number;
  zones: boolean;
}

const DEFAULTS: Readonly<Record<number, ChapterDefaults>> = {
  1: { pressure: 1.5, trap: 0.45, requires: [], lossyLinks: 0, zones: false },
  2: { pressure: 1.5, trap: 0.45, requires: [], lossyLinks: 0, zones: false },
  3: { pressure: 1.5, trap: 0.3, requires: ['split'], lossyLinks: 0, zones: false },
  4: { pressure: 1.4, trap: 0, requires: [], lossyLinks: 0, zones: false },
  5: { pressure: 1.5, trap: 0, requires: ['throttle'], lossyLinks: 0, zones: false },
  6: { pressure: 1.1, trap: 0, requires: ['queues'], lossyLinks: 0, zones: false },
  7: { pressure: 1.2, trap: 0, requires: ['backup'], lossyLinks: 0, zones: false },
  8: { pressure: 1.2, trap: 0, requires: [], lossyLinks: 0, zones: false },
  9: { pressure: 1.0, trap: 0, requires: ['redundancy'], lossyLinks: 2, zones: false },
  10: { pressure: 1.1, trap: 0, requires: ['stages'], lossyLinks: 0, zones: false },
  11: { pressure: 1.2, trap: 0, requires: [], lossyLinks: 0, zones: true },
  12: { pressure: 1.1, trap: 0, requires: [], lossyLinks: 0, zones: false },
  13: { pressure: 1.1, trap: 0, requires: [], lossyLinks: 1, zones: false },
};

const P: Readonly<Record<string, ProfileId>> = {
  W: 'web',
  V: 'video',
  O: 'voice',
  B: 'bulk',
  T: 'transaction',
  C: 'control',
};

const S: Readonly<Record<string, SituationKind>> = {
  calm: 'calm',
  rush: 'rush',
  cut: 'cut',
  lossy: 'lossy',
  moving: 'moving',
  flood: 'flood',
};

/** One level in short form: the setting, the title and story, then the shape of the network. */
type Row = readonly [
  setting: SettingId,
  title: string,
  story: string,
  nodes: number,
  family: Family,
  /** The profiles of the flows as letters: W web, V video, O voice, B bulk, T transaction, C control */
  profiles: string,
  /** The situations, separated by a space */
  situations: string,
  /** Overrides for this level */
  extra?: Partial<Pick<LevelPlan, 'pressure' | 'lossyLinks' | 'optional' | 'minBest' | 'requires'>>,
];

function chapter(number: number, rows: readonly Row[]): LevelPlan[] {
  const defaults = DEFAULTS[number];
  if (defaults === undefined) {
    throw new Error(`no defaults for chapter ${String(number)}`);
  }
  return rows.map(([setting, title, story, nodes, family, profiles, situations, extra], at) => ({
    id: `c${String(number)}-${String(at + 1)}`,
    chapter: number,
    setting,
    title,
    story,
    nodes,
    family,
    extraLinks: 0.5,
    profiles: Array.from(
      { length: profiles.length },
      (_, position) => P[profiles.charAt(position)] ?? 'web',
    ),
    situations: situations.split(' ').map((name) => S[name] ?? 'calm'),
    pressure: extra?.pressure ?? defaults.pressure,
    lossyLinks: extra?.lossyLinks ?? defaults.lossyLinks,
    minBest: extra?.minBest ?? MIN_BEST[number] ?? 0.8,
    trap: defaults.trap,
    optional: extra?.optional ?? 0,
    zones: defaults.zones,
    requires: extra?.requires ?? defaults.requires,
  }));
}

export const LEVEL_PLAN: readonly LevelPlan[] = [
  // 1. First packets: one rule, a few flows, nothing else
  ...chapter(1, [
    [
      'office',
      'The new printer',
      'A new floor, a new cable, and two teams want the shared drive at once.',
      6,
      'ring',
      'WW',
      'calm',
    ],
    [
      'office',
      'Monday morning',
      'Everyone logs in at nine. The cable to the file server was not made for that.',
      6,
      'grid',
      'WW',
      'calm',
    ],
    [
      'campus',
      'Exam week',
      'Three halls upload at the same time. Find each of them a road.',
      7,
      'mesh',
      'WWW',
      'calm',
    ],
    [
      'office',
      'Open plan',
      'More desks than cables. Somebody has to take the long way round.',
      7,
      'grid',
      'WWW',
      'calm',
    ],
    [
      'hospital',
      'Ward round',
      'Three wards ask the record system for the same files, all at once.',
      8,
      'mesh',
      'WWW',
      'calm',
    ],
    [
      'festival',
      'Gates open',
      'Four entrances scan tickets into one server. Spread them over the field.',
      8,
      'hub',
      'WWWW',
      'calm',
    ],
  ]),
  // 2. Sharing
  ...chapter(2, [
    [
      'hospital',
      'Morning rounds',
      'Records and lab results want the same corridor. Keep both moving.',
      7,
      'mesh',
      'WVW',
      'calm',
    ],
    [
      'campus',
      'Lecture night',
      'A live lecture, a downloaded course and a hundred students on the web.',
      8,
      'grid',
      'VWWV',
      'calm',
    ],
    [
      'festival',
      'Main gate',
      'Ticket scans and a live stream share the same few cables.',
      8,
      'hub',
      'WVWV',
      'calm',
    ],
    [
      'provider',
      'Prime time',
      'Everybody streams at eight. The metro ring is where it hurts.',
      9,
      'ring',
      'VVWW',
      'calm',
    ],
    [
      'datacentre',
      'Two tiers',
      'The web tier and the video tier both talk to the same racks.',
      8,
      'grid',
      'WWVV',
      'calm',
    ],
    [
      'office',
      'Town hall',
      'The whole company watches the same talk while mail and files go on as usual.',
      9,
      'mesh',
      'VWWVW',
      'calm',
    ],
  ]),
  // 3. Splitting
  ...chapter(3, [
    [
      'datacentre',
      'Two roads',
      'One big transfer and two cables that are each too small. Use both.',
      6,
      'ring',
      'VW',
      'calm',
    ],
    [
      'festival',
      'Main stage',
      'The live stream is bigger than any single cable on the field.',
      7,
      'hub',
      'VWW',
      'calm',
    ],
    [
      'campus',
      'Open day',
      'Video, mail and the web portal share a cramped campus.',
      8,
      'mesh',
      'VWV',
      'calm rush',
    ],
    [
      'provider',
      'Cup final',
      'The whole region watches the same match. Spread it over the ring.',
      9,
      'ring',
      'VVWW',
      'calm rush',
    ],
    [
      'hospital',
      'Imaging day',
      'Scans are huge, and every ward wants its own at once.',
      8,
      'grid',
      'VWV',
      'calm',
    ],
    [
      'datacentre',
      'Big transfer',
      'A migration needs every spare cable, and the shop must stay online.',
      9,
      'mesh',
      'VVW',
      'calm',
    ],
  ]),
  // 4. Latency
  ...chapter(4, [
    [
      'office',
      'The long call',
      'Calls crackle when they take the busy road. Keep voice on a quick path.',
      7,
      'grid',
      'OWW',
      'calm',
    ],
    [
      'hospital',
      'Nurse call',
      'The call system must be fast; the record system can wait a moment.',
      8,
      'mesh',
      'OWV',
      'calm rush',
    ],
    [
      'festival',
      'Crew radio',
      'Crew calls must reach the stage manager while the stream is at its peak.',
      8,
      'hub',
      'OOVW',
      'calm rush',
    ],
    [
      'datacentre',
      'On-call',
      'The ops bridge must stay clear while the build farm pushes out artifacts.',
      9,
      'grid',
      'OVWW',
      'calm rush',
    ],
    [
      'campus',
      'Helpdesk',
      'Phones ring while a lecture streams and the portal gets its rush.',
      8,
      'mesh',
      'OOWV',
      'calm rush',
    ],
    [
      'provider',
      'Emergency line',
      'Emergency calls first, then the match, then everything else.',
      9,
      'ring',
      'OVWW',
      'calm rush',
    ],
  ]),
  // 5. Priorities
  ...chapter(5, [
    [
      'office',
      'Backup night',
      'The nightly backup wants every cable. Let it have what is left.',
      7,
      'mesh',
      'OWB',
      'calm',
    ],
    [
      'hospital',
      'Scan archive',
      'The imaging archive is huge and patient calls are not.',
      7,
      'mesh',
      'OBW',
      'calm',
    ],
    [
      'datacentre',
      'Batch window',
      'Two bulk jobs, a web tier and a bridge call share the spine.',
      8,
      'grid',
      'OWBB',
      'calm rush',
    ],
    [
      'campus',
      'Mirror sync',
      'The software mirror syncs at the worst hour. Slow it down, not the exams.',
      8,
      'mesh',
      'OVBB',
      'calm rush',
      { pressure: 1.5, minBest: 0.65 },
    ],
    [
      'festival',
      'Upload rush',
      'Everybody uploads photos while the crew needs the radio.',
      8,
      'hub',
      'OBBB',
      'calm rush',
      { pressure: 1.5, minBest: 0.65 },
    ],
    [
      'provider',
      'Software release',
      'A release goes out to a million devices on the same night as the final.',
      8,
      'ring',
      'OVBB',
      'calm rush',
      { pressure: 1.5, minBest: 0.65 },
    ],
  ]),
  // 6. Queues
  ...chapter(6, [
    [
      'office',
      'Coffee break',
      'At eleven the whole floor opens a video at once. Then it is quiet again.',
      6,
      'grid',
      'WVB',
      'calm rush',
    ],
    [
      'campus',
      'Lecture ends',
      'A hall of students reaches for their phones at the same second.',
      7,
      'mesh',
      'WVV',
      'calm rush',
    ],
    [
      'festival',
      'Encore',
      'The crowd cheers, and every phone uploads the moment.',
      7,
      'hub',
      'VWB',
      'calm rush',
    ],
    [
      'hospital',
      'Shift change',
      'Two hundred badges log in within a minute, then nothing for hours.',
      8,
      'mesh',
      'OWV',
      'calm rush',
    ],
    [
      'provider',
      'Goal!',
      'A goal, and the whole region reloads the page in the same breath.',
      8,
      'ring',
      'VVWB',
      'calm rush',
    ],
    [
      'datacentre',
      'Flash sale',
      'The sale opens at noon. The queues are there to be used, but not to be filled.',
      9,
      'grid',
      'OWVB',
      'calm rush',
    ],
  ]),
  // 7. When things break
  ...chapter(7, [
    [
      'office',
      'The cut cable',
      'A builder digs through a cable. Give the important flow a way around.',
      6,
      'ring',
      'WO',
      'calm cut',
    ],
    [
      'hospital',
      'Night shift',
      'A link goes down at three in the morning. Monitors must not notice.',
      7,
      'mesh',
      'OWV',
      'calm cut',
    ],
    [
      'provider',
      'Storm',
      'Wind takes down a metro link. Customers should hardly notice.',
      8,
      'ring',
      'OVWW',
      'calm cut',
    ],
    [
      'datacentre',
      'Pulled plug',
      'Somebody pulls the wrong cable. The cluster has seconds to react.',
      9,
      'grid',
      'OWVB',
      'calm rush cut',
    ],
    [
      'campus',
      'Construction site',
      'The digger is back, and this time it is the main trench.',
      8,
      'mesh',
      'OVW',
      'calm cut',
    ],
    [
      'festival',
      'Cable thief',
      'Somebody cuts a cable for the copper, in the middle of the show.',
      9,
      'hub',
      'OVWB',
      'calm rush cut',
    ],
  ]),
  // 8. Budget
  ...chapter(8, [
    [
      'office',
      'The new wing',
      'Two cables could connect the new wing. The budget pays for one.',
      6,
      'grid',
      'WWV',
      'calm',
      { optional: 3 },
    ],
    [
      'campus',
      'Summer upgrade',
      'A summer to rebuild the campus network, with money for part of the plan.',
      8,
      'mesh',
      'VWWO',
      'calm',
      { optional: 4 },
    ],
    [
      'provider',
      'New ring',
      'Close the ring in the north, or lay a shortcut across the lake. Not both.',
      9,
      'ring',
      'VVWT',
      'calm rush',
      { optional: 4 },
    ],
    [
      'festival',
      'Pop-up network',
      'Three days, a field and a budget. Lay the cables that the crowd will need.',
      9,
      'hub',
      'OVWB',
      'calm rush',
      { optional: 5 },
    ],
    [
      'hospital',
      'New building',
      'The new wing opens in spring. Which cables does it need first?',
      8,
      'mesh',
      'OWVT',
      'calm',
      { optional: 4 },
    ],
    [
      'datacentre',
      'Second hall',
      'A second hall, a limited budget and a lot of traffic between the two.',
      9,
      'grid',
      'VWBT',
      'calm',
      { optional: 5 },
    ],
  ]),
  // 9. Loss
  ...chapter(9, [
    [
      'provider',
      'Wet cable',
      'One link drops packets whenever it rains. Pay a little to be safe.',
      6,
      'ring',
      'TW',
      'calm lossy',
      { lossyLinks: 1 },
    ],
    [
      'office',
      'Payday',
      'Payroll cannot lose a single packet. Everything else can lose a few.',
      7,
      'mesh',
      'TVW',
      'calm lossy',
    ],
    [
      'drones',
      'Over the ridge',
      'Radio links flicker. Commands must arrive, video may stutter.',
      8,
      'mesh',
      'CVWT',
      'calm lossy',
    ],
    [
      'hospital',
      'Telemetry',
      'Ventilator data and imaging cross a noisy wing. Protect the right one.',
      9,
      'grid',
      'CTVB',
      'calm lossy cut',
    ],
    [
      'festival',
      'Fog',
      'Wet air over the field, and the point-of-sale links lose packets. A few cables could still be built, within a budget.',
      8,
      'hub',
      'TVW',
      'calm lossy',
      { optional: 3 },
    ],
    [
      'datacentre',
      'Dirty fibre',
      'A dirty connector drops one packet in five. The ledger cannot lose any.',
      9,
      'grid',
      'TTVB',
      'calm lossy',
    ],
  ]),
  // 10. On the move
  ...chapter(10, [
    [
      'drones',
      'Passing relay',
      'A relay drifts out of range while another comes into range. Switch in time.',
      6,
      'mesh',
      'CV',
      'calm moving',
    ],
    [
      'drones',
      'Search pattern',
      'The swarm sweeps a valley. Links open and close as it moves.',
      8,
      'mesh',
      'CVW',
      'calm moving',
    ],
    [
      'festival',
      'Parade',
      'The parade carries its own camera and radio, and the field links come and go.',
      8,
      'hub',
      'OVT',
      'calm moving',
    ],
    [
      'drones',
      'Valley run',
      'Four drones and one ground station, and every link has its time.',
      8,
      'mesh',
      'CVW',
      'calm moving',
    ],
    [
      'provider',
      'Ferry crossing',
      'The ferry is in range of one shore, then of the other. A few cables could still be built, within a budget.',
      7,
      'ring',
      'OVW',
      'calm moving',
      { optional: 3 },
    ],
    [
      'drones',
      'Rescue convoy',
      'A convoy drives through the mountains. Radio links appear and vanish with every bend.',
      9,
      'mesh',
      'CVW',
      'calm moving',
    ],
  ]),
  // 11. Zones
  ...chapter(11, [
    [
      'office',
      'Guest wifi',
      'Visitors may use the web, but never talk to the file server directly. Everything goes through the firewall.',
      7,
      'grid',
      'WWV',
      'calm',
    ],
    [
      'hospital',
      'Visitors and patients',
      'Visitors, staff and the record system share one network. The firewall decides who passes.',
      9,
      'mesh',
      'OWVT',
      'calm rush',
    ],
    [
      'campus',
      'The open lab',
      'Students bring their own devices. Research data stays behind the firewall, and the firewall has only so much capacity.',
      10,
      'grid',
      'OVWT',
      'calm rush cut',
    ],
    [
      'datacentre',
      'Tenants',
      'Two customers share a hall. Their traffic meets only at the firewall. A few cables could still be built, within a budget.',
      8,
      'grid',
      'WVT',
      'calm',
      { optional: 3 },
    ],
    [
      'festival',
      'Press tent',
      'Journalists upload from the press tent. The ticket servers are off limits.',
      9,
      'hub',
      'OVW',
      'calm rush',
    ],
    [
      'provider',
      'Business park',
      'Companies in the park share a link, and every one of them has its own firewall rules.',
      10,
      'mesh',
      'OVWT',
      'calm rush',
    ],
  ]),
  // 12. Under attack
  ...chapter(12, [
    [
      'office',
      'Spam wave',
      'A flood of junk hits the mail server. Keep the rest of the office out of its way.',
      7,
      'mesh',
      'WWV',
      'calm flood',
    ],
    [
      'datacentre',
      'Packet storm',
      'A storm of packets heads for the database. The backup has to wait.',
      8,
      'grid',
      'OWVB',
      'calm flood',
    ],
    [
      'provider',
      'Botnet',
      'Thousands of hijacked cameras send traffic at one customer.',
      9,
      'ring',
      'OVWT',
      'calm flood',
    ],
    [
      'campus',
      'Exam hack',
      'Somebody floods the exam server minutes before the deadline. A few cables could still be built, within a budget.',
      8,
      'mesh',
      'OWT',
      'calm flood',
      { optional: 3 },
    ],
    [
      'hospital',
      'Ransom note',
      'The attackers want money, and send a flood to prove it.',
      9,
      'mesh',
      'CWVT',
      'calm flood',
    ],
    [
      'festival',
      'Ticket bots',
      'Bots hammer the ticket server while real fans try to get in.',
      9,
      'hub',
      'OVWT',
      'calm rush flood',
    ],
  ]),
  // 13. Everything
  ...chapter(13, [
    [
      'campus',
      'The big day',
      'Enrolment, an open day and a storm in the same week.',
      10,
      'mesh',
      'OVWTB',
      'calm rush cut',
    ],
    [
      'provider',
      'Black Friday',
      'Payments, streams and a storm that cuts the coast road. A few cables could still be built, within a budget.',
      10,
      'ring',
      'OVWTB',
      'calm rush cut',
      { optional: 4 },
    ],
    [
      'drones',
      'Rescue',
      'Control, camera and a map for the rescue team, over links that come and go.',
      10,
      'mesh',
      'CVWTB',
      'calm moving lossy',
    ],
    [
      'hospital',
      'Heatwave',
      'The cooling fails in one wing, a cable melts, and somebody picks the day to attack. A few cables could still be built, within a budget.',
      10,
      'grid',
      'COVT',
      'calm flood cut',
      { optional: 4 },
    ],
    [
      'datacentre',
      'Launch day',
      'A new product, a rush of customers and a flood from a competitor.',
      9,
      'grid',
      'OVWT',
      'calm rush flood',
    ],
    [
      'festival',
      'Headline act',
      'The biggest stream of the year, a crowd that uploads and bots that attack. A few cables could still be built, within a budget.',
      9,
      'hub',
      'OVWT',
      'calm rush flood',
      { optional: 4 },
    ],
  ]),
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
