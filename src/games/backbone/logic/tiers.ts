import { type LevelRecord } from '../data/pool';

/**
 * The tiers of random levels and what the address of a random level says. Small and without the
 * generator, so that the game can show them without loading the solver (`random-level.ts` is only
 * used by the background thread).
 */

export type Tier = 1 | 2 | 3 | 4 | 5;

export const tiers: readonly { tier: Tier; name: string; about: string }[] = [
  { tier: 1, name: 'Warm-up', about: 'Capacity only: a small network and a few flows.' },
  { tier: 2, name: 'Easy', about: 'Bigger networks, and flows that can be split.' },
  { tier: 3, name: 'Medium', about: 'Voice that must be fast and bulk traffic to hold back.' },
  { tier: 4, name: 'Hard', about: 'A cable will be cut, and some links lose packets.' },
  { tier: 5, name: 'Expert', about: 'Everything at once, in the biggest networks.' },
];

export interface Job {
  tier: Tier;
  seed: string;
  /** Try only this exact seed (a shared link): it is known to work */
  exact?: boolean;
}

/** The seed of a made level, as it is in a shared link. */
export function seedOf(record: LevelRecord): string {
  return record.id.replace(/^random-\d+-/, '');
}

export function tierOf(record: LevelRecord): Tier {
  const tier = Number(/^random-(\d)-/.exec(record.id)?.[1] ?? 1);
  return (tier >= 1 && tier <= 5 ? tier : 1) as Tier;
}

export function isRandom(id: string): boolean {
  return id.startsWith('random-');
}
