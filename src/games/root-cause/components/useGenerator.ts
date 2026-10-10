import { useCallback, useEffect, useRef, useState } from 'react';

import { createRandom, freshSeed } from '../../shared/random';
import { chooseJob, type Job, type RandomSetup, typicalMilliseconds } from '../logic/random-level';
import { type LevelRecord } from '../pool';
import { type WorkerReply } from './generate.worker';

/** A level that is being made */
export interface Run {
  job: Job;
  startedAt: number;
  /** About how long it takes, in milliseconds: only for the progress bar */
  typical: number;
  workers: number;
}

const MAX_WORKERS = 4;

/**
 * Makes random levels in background threads. Several workers try different seeds at the same
 * time and the first level that passes every check wins, which also cuts the long waits that a
 * single unlucky map can cause. Nothing leaves the browser, and ending the run ends the threads.
 */
export function useGenerator(onLevel: (record: LevelRecord) => void) {
  const [run, setRun] = useState<Run | undefined>();
  const [error, setError] = useState<string | undefined>();
  const workers = useRef<Worker[]>([]);
  const onLevelRef = useRef(onLevel);
  useEffect(() => {
    onLevelRef.current = onLevel;
  }, [onLevel]);

  const cancel = useCallback(() => {
    for (const worker of workers.current) {
      worker.terminate();
    }
    workers.current = [];
    setRun(undefined);
  }, []);

  // Leaving the page ends the threads
  useEffect(() => cancel, [cancel]);

  const start = useCallback(
    (setup: RandomSetup) => {
      cancel();
      setError(undefined);
      const seed = freshSeed().toString(36);
      const job = chooseJob(setup, createRandom(seed), seed);
      const count = Math.max(1, Math.min(MAX_WORKERS, (navigator.hardwareConcurrency || 2) - 1));
      try {
        const started: Worker[] = [];
        for (let index = 0; index < count; index += 1) {
          const worker = new Worker(new URL('./generate.worker.ts', import.meta.url), {
            type: 'module',
          });
          worker.onmessage = (event: MessageEvent<WorkerReply>) => {
            cancel();
            onLevelRef.current(event.data.record);
          };
          worker.onerror = () => {
            cancel();
            setError('The generator could not start in this browser.');
          };
          worker.postMessage({ ...job, seed: `${job.seed}-w${String(index + 1)}` });
          started.push(worker);
        }
        workers.current = started;
        setRun({
          job,
          startedAt: Date.now(),
          typical: typicalMilliseconds(job.tier, job.size),
          workers: count,
        });
      } catch {
        setError('The generator could not start in this browser.');
      }
    },
    [cancel],
  );

  return { run, error, start, cancel };
}
