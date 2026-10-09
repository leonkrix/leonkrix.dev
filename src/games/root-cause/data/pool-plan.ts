import { type Skin } from '../logic/skin';
import { type Tier } from '../logic/types';

/** What one level of the pool should be. The generator script fills it in, the tests check it. */
export interface LevelPlan {
  id: string;
  skin: Skin['id'];
  tier: Tier;
  size: number;
  /** The role of the victim: a founder, a developer, a database */
  victim: string;
}

/**
 * The pool: six levels per tier, in the order the player meets them, getting bigger within a tier.
 * The skins alternate so that both looks appear everywhere. Complete squares only; shapes come
 * later.
 */
export const LEVEL_PLAN: readonly LevelPlan[] = [
  { id: 'easy-1', skin: 'case-file', tier: 'easy', size: 4, victim: 'founder' },
  { id: 'easy-2', skin: 'outage', tier: 'easy', size: 4, victim: 'server' },
  { id: 'easy-3', skin: 'case-file', tier: 'easy', size: 5, victim: 'developer' },
  { id: 'easy-4', skin: 'outage', tier: 'easy', size: 5, victim: 'database' },
  { id: 'easy-5', skin: 'case-file', tier: 'easy', size: 6, victim: 'cto' },
  { id: 'easy-6', skin: 'outage', tier: 'easy', size: 6, victim: 'nas' },
  { id: 'medium-1', skin: 'outage', tier: 'medium', size: 5, victim: 'server' },
  { id: 'medium-2', skin: 'case-file', tier: 'medium', size: 6, victim: 'designer' },
  { id: 'medium-3', skin: 'outage', tier: 'medium', size: 6, victim: 'database' },
  { id: 'medium-4', skin: 'case-file', tier: 'medium', size: 7, victim: 'investor' },
  { id: 'medium-5', skin: 'outage', tier: 'medium', size: 7, victim: 'router' },
  { id: 'medium-6', skin: 'case-file', tier: 'medium', size: 7, victim: 'manager' },
  { id: 'hard-1', skin: 'case-file', tier: 'hard', size: 7, victim: 'auditor' },
  { id: 'hard-2', skin: 'outage', tier: 'hard', size: 7, victim: 'server' },
  { id: 'hard-3', skin: 'case-file', tier: 'hard', size: 8, victim: 'ceo' },
  { id: 'hard-4', skin: 'outage', tier: 'hard', size: 8, victim: 'firewall' },
  { id: 'hard-5', skin: 'case-file', tier: 'hard', size: 9, victim: 'admin' },
  { id: 'hard-6', skin: 'outage', tier: 'hard', size: 9, victim: 'balancer' },
];

/**
 * The fewest rooms a map of the pool has. The engine allows fewer, but a map of two big rooms is
 * dull to look at, so the pool leaves such maps out.
 */
export function minRoomsOf(size: number): number {
  return size <= 5 ? 3 : size <= 7 ? 4 : 5;
}
