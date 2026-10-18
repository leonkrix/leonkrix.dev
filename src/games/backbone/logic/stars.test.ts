import { describe, expect, it } from 'vitest';

import { isAdmissible, starsFor, starThresholds } from './stars';

describe('stars', () => {
  const baselines = { shortest: 0.5, balanced: 0.6, best: 0.9 };
  const thresholds = starThresholds(baselines);

  it('puts the steps between shortest path and the best plan', () => {
    expect(thresholds.one).toBe(0.5);
    expect(thresholds.two).toBeCloseTo(0.66, 9);
    expect(thresholds.three).toBeCloseTo(0.88, 9);
  });

  it('asks for more than the better strategy for the second star', () => {
    const close = starThresholds({ shortest: 0.5, balanced: 0.8, best: 0.9 });
    expect(close.two).toBe(0.8);
  });

  it('counts stars at the thresholds', () => {
    expect(starsFor(0.49, thresholds)).toBe(0);
    expect(starsFor(0.5, thresholds)).toBe(1);
    expect(starsFor(0.65, thresholds)).toBe(1);
    expect(starsFor(0.66, thresholds)).toBe(2);
    expect(starsFor(0.87, thresholds)).toBe(2);
    expect(starsFor(0.88, thresholds)).toBe(3);
    expect(starsFor(1, thresholds)).toBe(3);
  });

  it('admits a level only when the best plan clearly beats both strategies', () => {
    expect(isAdmissible(baselines)).toBe(true);
    expect(isAdmissible({ shortest: 0.5, balanced: 0.6, best: 0.62 })).toBe(false);
    expect(isAdmissible({ shortest: 0.9, balanced: 0.5, best: 0.93 })).toBe(false);
    expect(isAdmissible({ shortest: 0.5, balanced: 0.5, best: 0.5 })).toBe(false);
  });
});
