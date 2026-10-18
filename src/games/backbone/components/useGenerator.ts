import { useCallback, useEffect, useRef, useState } from 'react';

import { freshSeed } from '../../shared/random';
import { type LevelRecord } from '../data/pool';
import { type Job, type Tier } from '../logic/random-level';
import { type WorkerReply } from './generate.worker';

const MOST_WORKERS = 3;

/**
 * Makes random levels in background threads. Several workers try different seeds at the same time
 * and the first level that passes every check wins, which also cuts the long waits that one
 * unlucky network can cause. Nothing leaves the browser, and ending the run ends the threads.
 */
export function useGenerator(onLevel: (record: LevelRecord) => void) {
  const [running, setRunning] = useState(false);
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
    setRunning(false);
  }, []);

  // Leaving the page ends the threads
  useEffect(() => cancel, [cancel]);

  const launch = useCallback(
    (job: Job, count: number) => {
      cancel();
      setError(undefined);
      try {
        const started: Worker[] = [];
        for (let index = 0; index < count; index += 1) {
          const worker = new Worker(new URL('./generate.worker.ts', import.meta.url), {
            type: 'module',
          });
          worker.onmessage = (event: MessageEvent<WorkerReply>) => {
            cancel();
            if (event.data.type === 'done') {
              onLevelRef.current(event.data.record);
            } else {
              setError(event.data.message);
            }
          };
          worker.onerror = () => {
            cancel();
            setError('The generator could not start in this browser.');
          };
          worker.postMessage({
            ...job,
            seed: job.exact === true ? job.seed : `${job.seed}-w${String(index + 1)}`,
          });
          started.push(worker);
        }
        workers.current = started;
        setRunning(true);
      } catch {
        setError('The generator could not start in this browser.');
      }
    },
    [cancel],
  );

  const start = useCallback(
    (tier: Tier) => {
      const count = Math.max(1, Math.min(MOST_WORKERS, (navigator.hardwareConcurrency || 2) - 1));
      launch({ tier, seed: freshSeed().toString(36) }, count);
    },
    [launch],
  );

  /** Makes the level of a shared link: the seed is known to work, so one thread is enough */
  const startExact = useCallback(
    (tier: Tier, seed: string) => {
      launch({ tier, seed, exact: true }, 1);
    },
    [launch],
  );

  return { running, error, start, startExact, cancel };
}
