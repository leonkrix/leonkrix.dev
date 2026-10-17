import type { Profile, ProfileId } from './types';

/**
 * What each kind of traffic cares about. The names are plain descriptions of the traffic.
 *
 * Delay is counted in the units of `NetLink.delay` (1 to 4 per link), so a latency budget of 6 is
 * "about three short hops". Numbers are tuned together with the levels, not on their own.
 */
export const profiles: Readonly<Record<ProfileId, Profile>> = {
  voice: {
    id: 'voice',
    name: 'Voice',
    weight: 3,
    latencyBudget: 6,
    steepness: 1.5,
    lossExponent: 1.5,
    queue: 0,
    throttlable: false,
  },
  control: {
    id: 'control',
    name: 'Control',
    weight: 4,
    latencyBudget: 8,
    steepness: 1,
    lossExponent: 3,
    queue: 0,
    throttlable: false,
  },
  transaction: {
    id: 'transaction',
    name: 'Transaction',
    weight: 3,
    latencyBudget: 14,
    steepness: 0.5,
    lossExponent: 4,
    queue: 1,
    throttlable: false,
  },
  video: {
    id: 'video',
    name: 'Video',
    weight: 2,
    latencyBudget: 14,
    steepness: 0.7,
    lossExponent: 1.5,
    queue: 1,
    throttlable: false,
  },
  web: {
    id: 'web',
    name: 'Web',
    weight: 2,
    latencyBudget: 20,
    steepness: 0.3,
    lossExponent: 1.2,
    queue: 1,
    throttlable: false,
  },
  bulk: {
    id: 'bulk',
    name: 'Bulk',
    weight: 1,
    latencyBudget: undefined,
    steepness: 0,
    lossExponent: 1,
    queue: 2,
    throttlable: true,
  },
};

export const profileIds = Object.keys(profiles) as ProfileId[];
