import type { ExperienceEntry, ExperienceType } from './experience';
import { experienceGroups } from './experience';

/**
 * Layout of the horizontal timeline strip above the experience list. It is calculated from the
 * experience entries, so a new entry appears in the strip without any extra work. All positions
 * are percentages of the strip width. Pure functions, no DOM.
 */

type Entry = Pick<ExperienceEntry, 'type' | 'title' | 'start' | 'end' | 'short'>;

export interface TimelineBar {
  label: string;
  /** Left edge and width in percent */
  left: number;
  width: number;
  /** A position without an end date runs until today */
  ongoing: boolean;
  /** 0 for the first row of its lane, higher when entries of one type overlap */
  row: number;
}

export interface TimelineLane {
  type: ExperienceType;
  title: string;
  rows: number;
  bars: TimelineBar[];
}

export interface Span {
  left: number;
  width: number;
}

export interface TimelineModel {
  /** One tick per year, positioned at 1 January */
  ticks: { year: number; left: number }[];
  lanes: TimelineLane[];
  /** Periods in which a job ran next to studies, to highlight them across the lanes */
  overlaps: Span[];
}

/** "2024-04" becomes a month counter, so months can be compared and subtracted */
function monthIndex(value: string): number {
  const [year, month] = value.split('-').map(Number);
  if (year === undefined || month === undefined || Number.isNaN(year) || Number.isNaN(month)) {
    throw new Error(`Invalid month "${value}", expected YYYY-MM.`);
  }
  return year * 12 + (month - 1);
}

function currentMonth(now: Date): string {
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export function buildTimeline(entries: readonly Entry[], now: Date): TimelineModel | undefined {
  if (entries.length === 0) {
    return undefined;
  }

  const today = currentMonth(now);
  const spans = entries.map((entry) => ({
    entry,
    from: monthIndex(entry.start),
    // The end month counts completely, so a bar runs to the end of it
    to: monthIndex(entry.end ?? today) + 1,
    ongoing: entry.end === undefined,
  }));

  // The strip covers whole years, from 1 January of the first to 31 December of the last
  const firstYear = Math.floor(Math.min(...spans.map((span) => span.from)) / 12);
  const lastYear = Math.floor((Math.max(...spans.map((span) => span.to)) - 1) / 12);
  const rangeStart = firstYear * 12;
  const rangeEnd = (lastYear + 1) * 12;
  const total = rangeEnd - rangeStart;
  const percent = (months: number): number => round(((months - rangeStart) / total) * 100);

  const lanes: TimelineLane[] = experienceGroups
    .map((group) => {
      const own = spans
        .filter((span) => span.entry.type === group.type)
        .sort((a, b) => a.from - b.from);
      // Entries of one type that overlap go into separate rows
      const rowEnds: number[] = [];
      const bars = own.map((span): TimelineBar => {
        let row = rowEnds.findIndex((end) => end <= span.from);
        if (row === -1) {
          row = rowEnds.length;
        }
        rowEnds[row] = span.to;
        return {
          label: span.entry.short ?? span.entry.title,
          left: percent(span.from),
          width: round(percent(span.to) - percent(span.from)),
          ongoing: span.ongoing,
          row,
        };
      });
      return { type: group.type, title: group.title, rows: Math.max(rowEnds.length, 1), bars };
    })
    .filter((lane) => lane.bars.length > 0);

  const education = spans.filter((span) => span.entry.type === 'education');
  const overlaps: Span[] = [];
  for (const job of spans.filter((span) => span.entry.type === 'work')) {
    for (const study of education) {
      const from = Math.max(job.from, study.from);
      const to = Math.min(job.to, study.to);
      if (to > from) {
        overlaps.push({ left: percent(from), width: round(percent(to) - percent(from)) });
      }
    }
  }

  const ticks = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => ({
    year: firstYear + index,
    left: percent((firstYear + index) * 12),
  }));

  return { ticks, lanes, overlaps };
}
