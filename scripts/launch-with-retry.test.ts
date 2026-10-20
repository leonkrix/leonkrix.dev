import { describe, expect, it } from 'vitest';

import { launchWithRetry } from './launch-with-retry.mjs';

const noWait = (): Promise<void> => Promise.resolve();

describe('launchWithRetry', () => {
  it('starts once when the start works', async () => {
    let calls = 0;
    const result = await launchWithRetry(
      () => {
        calls += 1;
        return Promise.resolve('chrome');
      },
      { wait: noWait },
    );
    expect(result).toBe('chrome');
    expect(calls).toBe(1);
  });

  it('tries again after a failed start and says so', async () => {
    let calls = 0;
    const messages: string[] = [];
    const waits: number[] = [];
    const result = await launchWithRetry(
      () => {
        calls += 1;
        return calls < 3
          ? Promise.reject(new Error('waiting for dynamic debugging port in chrome-err.log'))
          : Promise.resolve('chrome');
      },
      {
        pauseMs: 10,
        log: (message) => messages.push(message),
        wait: (ms) => {
          waits.push(ms);
          return Promise.resolve();
        },
      },
    );
    expect(result).toBe('chrome');
    expect(calls).toBe(3);
    expect(waits).toEqual([10, 10]);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('debugging port');
    expect(messages[0]).toContain('1 of 3');
  });

  it('gives up with the last error when every start fails', async () => {
    let calls = 0;
    await expect(
      launchWithRetry(
        () => {
          calls += 1;
          return Promise.reject(new Error(`start ${String(calls)} failed`));
        },
        { attempts: 3, wait: noWait },
      ),
    ).rejects.toThrow('start 3 failed');
    expect(calls).toBe(3);
  });
});
