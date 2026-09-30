import { describe, expect, it } from 'vitest';

import { experienceSchema, formatMonth, formatRange, sortExperience } from './experience';

const valid = {
  type: 'work',
  title: 'Developer',
  organization: 'Example GmbH',
  start: '2022-10',
  end: '2023-09',
  highlights: ['Did something'],
};

describe('experienceSchema', () => {
  it('accepts a valid entry, with and without end date', () => {
    expect(experienceSchema.safeParse(valid).success).toBe(true);
    expect(experienceSchema.safeParse({ ...valid, end: undefined }).success).toBe(true);
  });

  it('rejects invalid months, unknown types and an end before the start', () => {
    expect(experienceSchema.safeParse({ ...valid, start: '2022-13' }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...valid, start: '2022-1' }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...valid, type: 'hobby' }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...valid, end: '2022-01' }).success).toBe(false);
  });

  it('requires at least one highlight and limits the coursework', () => {
    expect(experienceSchema.safeParse({ ...valid, highlights: [] }).success).toBe(false);
    const many = Array.from({ length: 11 }, (_, index) => `Course ${String(index)}`);
    expect(experienceSchema.safeParse({ ...valid, coursework: many }).success).toBe(false);
  });
});

describe('formatMonth and formatRange', () => {
  it('formats months in English', () => {
    expect(formatMonth('2024-04')).toBe('Apr 2024');
    expect(formatMonth('2018-10')).toBe('Oct 2018');
  });

  it('throws for an invalid month', () => {
    expect(() => formatMonth('2024-13')).toThrow('Invalid month');
  });

  it('shows a range, and "Present" without end', () => {
    expect(formatRange({ start: '2024-04', end: '2026-09' })).toBe('Apr 2024 – Sep 2026');
    expect(formatRange({ start: '2025-01' })).toBe('Jan 2025 – Present');
  });
});

describe('sortExperience', () => {
  it('sorts newest first and puts a current position first', () => {
    const sorted = sortExperience([
      { id: 'old', start: '2018-10', end: '2024-03' },
      { id: 'current', start: '2025-01' },
      { id: 'mid', start: '2022-10', end: '2023-09' },
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(['current', 'old', 'mid']);
  });

  it('does not change the input array', () => {
    const input = [
      { id: 'a', start: '2020-01', end: '2020-06' },
      { id: 'b', start: '2021-01', end: '2021-06' },
    ];
    sortExperience(input);
    expect(input[0]?.id).toBe('a');
  });
});
