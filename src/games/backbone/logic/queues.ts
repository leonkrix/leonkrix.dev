import type { Level, NetLink } from './types';

/**
 * Queues (chapter 6). Every link has one queue, as big as the link: it holds what the link carries
 * in one step. Traffic that does not fit through the link in a step waits in the queue and goes
 * on in a later step; the queue is served by priority (voice and control, then web, video and
 * payments, then bulk). When more waits than the queue holds, what comes last in the order of
 * priority is dropped first. Waiting makes the traffic late: a unit of backlog costs
 * `QUEUE_DELAY` units of delay for every step the link needs to work it off, and traffic waits
 * behind the classes that are served before it.
 *
 * Without the rule (`Rules.queues` false) the queue is empty and nothing waits, which is the
 * model of the first chapters.
 */

/** Units of delay that one step worth of backlog adds */
export const QUEUE_DELAY = 3;

/** The queue of a link holds as much as the link carries in one step (its nominal capacity). */
export function bufferSize(level: Level, link: NetLink): number {
  return level.rules.queues ? link.capacity : 0;
}
