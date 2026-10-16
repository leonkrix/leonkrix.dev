import { describe, expect, it } from 'vitest';

import { angleOf, isOnScreen, pingDelay, summary, SWEEP_MS, uniqueByLabel } from './radar';

const screen = { width: 1000, height: 800 };
/** A box of 20 by 20 whose middle is at the given place */
const at = (cx: number, cy: number) => ({ x: cx - 10, y: cy - 10, width: 20, height: 20 });

describe('angleOf', () => {
  it('counts degrees clockwise from the top', () => {
    expect(angleOf(at(500, 100), screen)).toBeCloseTo(0);
    expect(angleOf(at(900, 400), screen)).toBeCloseTo(90);
    expect(angleOf(at(500, 700), screen)).toBeCloseTo(180);
    expect(angleOf(at(100, 400), screen)).toBeCloseTo(270);
  });

  it('puts the corners between the directions', () => {
    expect(angleOf(at(900, 100), screen)).toBeGreaterThan(0);
    expect(angleOf(at(900, 100), screen)).toBeLessThan(90);
    expect(angleOf(at(900, 700), screen)).toBeGreaterThan(90);
    expect(angleOf(at(100, 700), screen)).toBeGreaterThan(180);
    expect(angleOf(at(100, 100), screen)).toBeGreaterThan(270);
    expect(angleOf(at(100, 100), screen)).toBeLessThan(360);
  });

  it('is always from 0 up to, but not including, 360', () => {
    for (let x = 0; x <= 1000; x += 125) {
      for (let y = 0; y <= 800; y += 100) {
        const angle = angleOf(at(x, y), screen);
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThan(360);
      }
    }
  });
});

describe('pingDelay', () => {
  it('lets the beam arrive in the order of the angles, and within one turn', () => {
    expect(pingDelay(0)).toBe(0);
    expect(pingDelay(90)).toBe(SWEEP_MS / 4);
    expect(pingDelay(180)).toBe(SWEEP_MS / 2);
    expect(pingDelay(359.9)).toBeLessThanOrEqual(SWEEP_MS);
    expect(pingDelay(10)).toBeLessThan(pingDelay(200));
  });
});

describe('isOnScreen', () => {
  it('needs a size and some overlap with the screen', () => {
    expect(isOnScreen(at(500, 400), screen)).toBe(true);
    expect(isOnScreen({ x: 0, y: 0, width: 0, height: 40 }, screen)).toBe(false);
    expect(isOnScreen({ x: 0, y: 900, width: 100, height: 100 }, screen)).toBe(false);
    expect(isOnScreen({ x: 0, y: -150, width: 100, height: 100 }, screen)).toBe(false);
    expect(isOnScreen({ x: 950, y: 0, width: 100, height: 100 }, screen)).toBe(true);
    expect(isOnScreen({ x: -50, y: 0, width: 100, height: 100 }, screen)).toBe(true);
  });
});

describe('uniqueByLabel', () => {
  it('keeps the first of every label and drops empty ones', () => {
    const items = [{ label: 'a' }, { label: 'b' }, { label: 'a' }, { label: ' ' }, { label: '' }];
    expect(uniqueByLabel(items)).toEqual([{ label: 'a' }, { label: 'b' }]);
  });
});

describe('summary', () => {
  it('says how many things it found, and what it says for none', () => {
    expect(summary(1)).toContain('1 thing worth');
    expect(summary(4)).toContain('4 things worth');
    expect(summary(0)).toContain('nothing special');
  });
});
