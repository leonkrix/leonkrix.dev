import { type LevelRecord } from '../data/pool';
import { type Job, runJob } from '../logic/random-level';

/**
 * Makes one level in the background, so that the page stays responsive while the generator works
 * (it proves the best plan, which can take a few seconds). The page sends a job and gets the level
 * back; to cancel, the page ends the worker.
 */
export type WorkerReply =
  { type: 'done'; record: LevelRecord } | { type: 'failed'; message: string };

self.onmessage = (event: MessageEvent<Job>) => {
  try {
    const reply: WorkerReply = { type: 'done', record: runJob(event.data) };
    self.postMessage(reply);
  } catch (error) {
    const reply: WorkerReply = {
      type: 'failed',
      message: error instanceof Error ? error.message : 'The level could not be made.',
    };
    self.postMessage(reply);
  }
};
