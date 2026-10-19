import { describe, expect, it } from 'vitest';

import { isAdmissible, pointsOf, starsFor, starThresholds } from './stars';

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

describe('the stars follow the points that are shown', () => {
  const thresholds = { one: 0.754, two: 0.86, three: 0.99 };

  it('rounds like the screen: 76 points against a threshold shown as 75 is a star', () => {
    expect(pointsOf(0.7551)).toBe(76);
    expect(pointsOf(0.754)).toBe(75);
    expect(starsFor(0.7551, thresholds)).toBe(1);
    // 75.6 is shown as 76, the threshold 75.9 is shown as 76 too: it is a star
    expect(starsFor(0.756, { ...thresholds, one: 0.759 })).toBe(1);
    expect(starsFor(0.744, thresholds)).toBe(0);
  });
});
