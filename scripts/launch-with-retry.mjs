/**
 * Starts a program that can fail to start now and then (Chrome on a CI runner: "waiting for dynamic
 * debugging port" happens once in a while and has nothing to do with the code under test). It tries
 * a few times, with a pause in between, and only then gives up with the last error. What runs
 * afterwards is not touched: a measurement that fails is never repeated, only the start is.
 */

/**
 * @template T
 * @param {() => Promise<T>} start
 * @param {{ attempts?: number, pauseMs?: number, log?: (message: string) => void, wait?: (ms: number) => Promise<void> }} [options]
 * @returns {Promise<T>}
 */
export async function launchWithRetry(start, options = {}) {
  const {
    attempts = 3,
    pauseMs = 3000,
    log = () => undefined,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await start();
    } catch (error) {
      lastError = error;
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt < attempts) {
        log(
          `The start failed (${reason}), trying again (${String(attempt)} of ${String(attempts)}).`,
        );
        await wait(pauseMs);
      }
    }
  }
  throw lastError;
}
