import { describe, expect, it } from 'vitest';

import { withBuilt } from './build';
import { indexLevel } from './graph';
import { placeNames } from './labels';
import { runJob, specFor } from './random-level';
import { evaluate } from './simulate';
import { solveDesign } from './solver';
import { isAdmissible } from './stars';
import { isRandom, seedOf, tierOf, tiers } from './tiers';
import { problemsOfLevel } from './validate';

describe('random levels', () => {
  it('make the same description from the same seed', () => {
    expect(specFor(2, 'abc')).toEqual(specFor(2, 'abc'));
    expect(specFor(2, 'abc')).not.toEqual(specFor(2, 'abd'));
    expect(tiers).toHaveLength(5);
  });

  it.each([1, 2] as const)(
    'make a level on tier %i that passes the checks of the campaign',
    (tier) => {
      const record = runJob({ tier, seed: `test-${String(tier)}` }, 4000);
      expect(isRandom(record.id)).toBe(true);
      expect(tierOf(record)).toBe(tier);
      expect(problemsOfLevel(record.level)).toEqual([]);
      expect(placeNames(record.level).conflicts).toBe(0);
      expect(
        isAdmissible({
          shortest: record.shortest,
          balanced: record.balanced,
          best: record.best.score,
        }),
      ).toBe(true);
      expect(record.best.score).toBeGreaterThanOrEqual(0.999);
      const index = indexLevel(withBuilt(record.level, record.best.built));
      expect(evaluate(index, record.best.plan).score).toBeCloseTo(record.best.score, 9);
      const proven = solveDesign(record.level, { limits: { pathLimit: 5 } });
      expect(proven.score).toBeCloseTo(record.best.score, 9);
    },
    60_000,
  );

  it('are made again from the seed that worked', () => {
    const first = runJob({ tier: 1, seed: 'again' }, 4000);
    const second = runJob({ tier: 1, seed: seedOf(first), exact: true }, 4000);
    expect(second.level).toEqual(first.level);
    expect(second.best.score).toBeCloseTo(first.best.score, 9);
  }, 60_000);
});
