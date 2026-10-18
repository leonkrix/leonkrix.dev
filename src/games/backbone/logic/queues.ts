import type { Level, NetLink } from './types';

/**
 * Queues (chapter 6). Every link has a buffer for each queue class. Traffic that does not fit
 * through the link in a step waits in the buffer of its class and goes on in a later step, as long
 * as the buffer has room; what does not fit into the buffer is dropped. Waiting makes the traffic
 * late: a unit of backlog costs `QUEUE_DELAY` units of delay for every step the link needs to
 * work it off. Traffic waits behind the classes that are served before it.
 *
 * Without the rule (`Rules.queues` false) every buffer is empty and nothing waits, which is the
 * model of the first chapters.
 */

/** Units of delay that one step worth of backlog adds */
export const QUEUE_DELAY = 3;

export function bufferSize(level: Level, link: NetLink): number {
  return level.rules.queues ? Math.max(0, link.buffer ?? 0) : 0;
}
