import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The browser tests and the Lighthouse gate run in the CI as several jobs at once, each with its
// part of the work (Playwright's --shard, the --shard of scripts/lighthouse.mjs). The number of
// parts stands in three places of each job: the matrix, the name and the argument. If they differ
// (a part is taken out of the matrix, or the argument says /3 and the matrix has two), some tests
// or pages would silently never run, and the CI would still be green. This test makes that fail.

const workflow = readFileSync(
  join(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml'),
  'utf8',
);

/** The text of one job: from its key to the next key at the same indent */
function job(id: string): string {
  const start = workflow.indexOf(`\n  ${id}:\n`);
  expect(start, `the job ${id} is in ci.yml`).toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

const sharded = [
  { id: 'e2e', command: /pnpm test:e2e --shard=\$\{\{ matrix\.shard \}\}\/(\d+)/, parts: 2 },
  {
    id: 'lighthouse',
    command: /pnpm lighthouse --shard \$\{\{ matrix\.shard \}\}\/(\d+)/,
    parts: 3,
  },
];

describe.each(sharded)('the CI job $id', ({ id, command, parts }) => {
  const text = job(id);

  it('has a matrix with every part, from 1 up to the number of parts', () => {
    const list = /shard: \[([^\]]*)\]/.exec(text)?.[1];
    expect(list, 'a matrix of shards').toBeDefined();
    const numbers = (list ?? '').split(',').map((entry) => Number(entry.trim()));
    expect(numbers).toEqual(Array.from({ length: parts }, (_, index) => index + 1));
  });

  it('tells every part how many parts there are, the same number as the matrix', () => {
    expect(command.exec(text)?.[1], 'the argument of the command').toBe(String(parts));
    expect(
      new RegExp(`name: .*\\(\\$\\{\\{ matrix\\.shard \\}\\}/${String(parts)}\\)`).test(text),
    ).toBe(true);
  });

  it('does not stop the other parts when one fails, and keeps a report of every part', () => {
    expect(text).toContain('fail-fast: false');
    expect(text).toMatch(/name: [a-z-]+-\$\{\{ matrix\.shard \}\}/);
  });
});

describe('the gate that deployment waits for', () => {
  it('still needs both jobs, whatever their parts, under the same names', () => {
    const gate = workflow.match(/needs: \[([^\]]*)\]/g)?.at(-1) ?? '';
    for (const { id } of sharded) {
      expect(gate, `ci-ok needs ${id}`).toContain(id);
    }
  });
});
