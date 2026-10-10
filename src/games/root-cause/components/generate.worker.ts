import { type Job, runJob } from '../logic/random-level';
import { type LevelRecord } from '../pool';

/**
 * Makes one level in the background, so that the page stays responsive while the generator
 * works. The page sends a job and gets the level back; to cancel, the page ends the worker.
 */
export interface WorkerReply {
  type: 'done';
  record: LevelRecord;
}

self.onmessage = (event: MessageEvent<Job>) => {
  const reply: WorkerReply = { type: 'done', record: runJob(event.data) };
  self.postMessage(reply);
};
