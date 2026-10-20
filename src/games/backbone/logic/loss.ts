import type { Level, NetLink } from './types';

/** What a cable loses: how much, and whether it does so all the time or only in some situations. */
export interface CableLoss {
  /** 0 to 1 */
  share: number;
  atTimes: boolean;
}

/**
 * The loss of a cable for the screen. Before the run it is what the cable loses all the time, or
 * else the most it loses in some situation (`atTimes`); while the run goes on it is what the cable
 * loses right now (`current`, from the stress test), which is not "at times" any more.
 */
export function lossOfCable(
  level: Level,
  link: NetLink,
  current?: { loss: number },
  running = false,
): CableLoss | undefined {
  if (running) {
    return current !== undefined && current.loss > 0.005
      ? { share: current.loss, atTimes: false }
      : undefined;
  }
  if (link.loss > 0) {
    return { share: link.loss, atTimes: false };
  }
  const worst = Math.max(
    0,
    ...level.situations.flatMap((situation) =>
      situation.events.flatMap((event) =>
        event.kind === 'lossy' && event.link === link.id ? [event.loss] : [],
      ),
    ),
  );
  return worst > 0 ? { share: worst, atTimes: true } : undefined;
}

export function percentOf(share: number): string {
  return `${String(Math.round(share * 100))} %`;
}
