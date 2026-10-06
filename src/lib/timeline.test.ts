import { describe, expect, it } from 'vitest';

import { buildTimeline } from './timeline';

const now = new Date(2026, 9, 7); // 7 October 2026

const bsc = {
  type: 'education',
  title: 'B.Sc. Information Systems',
  short: 'B.Sc.',
  start: '2018-10',
  end: '2024-03',
} as const;
const msc = {
  type: 'education',
  title: 'M.Sc. Information Systems',
  short: 'M.Sc.',
  start: '2024-04',
  end: '2026-09',
} as const;
const job = {
  type: 'work',
  title: 'University teaching assistant',
  start: '2022-10',
  end: '2023-09',
} as const;

describe('buildTimeline', () => {
  it('returns nothing without entries', () => {
    expect(buildTimeline([], now)).toBeUndefined();
  });

  it('covers whole years and puts a tick on every 1 January', () => {
    const model = buildTimeline([bsc, msc, job], now);
    expect(model?.ticks.map((tick) => tick.year)).toEqual([
      2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
    expect(model?.ticks[0]?.left).toBe(0);
    // Nine years, so every year is a ninth of the strip
    expect(model?.ticks[1]?.left).toBeCloseTo(11.11, 1);
  });

  it('places the bars by month and lets an end month count completely', () => {
    const model = buildTimeline([bsc, msc, job], now);
    const education = model?.lanes.find((lane) => lane.type === 'education');
    const [first, second] = education?.bars ?? [];
    // Oct 2018 is month 9 of 108, the bar runs 66 months (to the end of Mar 2024)
    expect(first?.left).toBeCloseTo((9 / 108) * 100, 1);
    expect(first?.width).toBeCloseTo((66 / 108) * 100, 1);
    // Apr 2024 starts right where Mar 2024 ended: no gap and no overlap
    expect((first?.left ?? 0) + (first?.width ?? 0)).toBeCloseTo(second?.left ?? -1, 1);
    // The last bar ends with Sep 2026, a few months before the end of the strip
    expect((second?.left ?? 0) + (second?.width ?? 0)).toBeLessThan(100);
  });

  it('uses the short label and falls back to the title', () => {
    const model = buildTimeline([bsc, job], now);
    expect(model?.lanes[0]?.bars[0]?.label).toBe('B.Sc.');
    expect(model?.lanes[1]?.bars[0]?.label).toBe('University teaching assistant');
  });

  it('lists the lanes in display order and leaves out empty ones', () => {
    expect(buildTimeline([job, bsc], now)?.lanes.map((lane) => lane.type)).toEqual([
      'education',
      'work',
    ]);
    expect(buildTimeline([bsc], now)?.lanes.map((lane) => lane.type)).toEqual(['education']);
  });

  it('highlights the time a job ran next to studies', () => {
    const model = buildTimeline([bsc, msc, job], now);
    expect(model?.overlaps).toHaveLength(1);
    const [overlap] = model?.overlaps ?? [];
    // Oct 2022 to Sep 2023 is twelve months
    expect(overlap?.width).toBeCloseTo((12 / 108) * 100, 1);
    expect(
      buildTimeline([bsc, { ...job, start: '2025-01', end: '2025-06' }], now)?.overlaps,
    ).toEqual([]);
  });

  it('lets a position without an end run until today and marks it', () => {
    const model = buildTimeline([bsc, { ...job, start: '2025-01', end: undefined }], now);
    const work = model?.lanes.find((lane) => lane.type === 'work');
    expect(work?.bars[0]?.ongoing).toBe(true);
    // The strip extends to the end of the current year, so the bar stops short of the edge
    expect(model?.ticks.at(-1)?.year).toBe(2026);
    expect((work?.bars[0]?.left ?? 0) + (work?.bars[0]?.width ?? 0)).toBeLessThan(100);
  });

  it('puts overlapping entries of one type into separate rows', () => {
    const model = buildTimeline(
      [
        { type: 'work', title: 'A', start: '2020-01', end: '2021-12' },
        { type: 'work', title: 'B', start: '2021-06', end: '2022-06' },
        { type: 'work', title: 'C', start: '2022-07', end: '2023-01' },
      ],
      now,
    );
    const work = model?.lanes[0];
    expect(work?.bars.map((bar) => bar.row)).toEqual([0, 1, 0]);
    expect(work?.rows).toBe(2);
  });

  it('rejects a month that is not YYYY-MM', () => {
    expect(() => buildTimeline([{ ...bsc, start: 'soon' }], now)).toThrow('Invalid month');
  });
});
