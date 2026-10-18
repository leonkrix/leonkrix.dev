import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { type LevelRecord } from '../data/pool';
import { hintFor } from './hint';
import { applyStrategy, startState } from './play';

const levels = JSON.parse(
  readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'),
) as LevelRecord[];

/** The status line has room for three lines, and for four on a narrow map: a hint must fit. */
const LONGEST = 130;

describe('the hints of the pool', () => {
  it.each(levels.map((record) => [record.id, record] as const))(
    'are short enough for the status line on %s',
    (_id, record) => {
      const state = applyStrategy(startState(record.level), 'shortest');
      const guide = { plan: record.best.plan, built: record.best.built, score: record.best.score };
      for (const stage of [1, 2, 3] as const) {
        const { text } = hintFor(state, guide, stage);
        expect(text.length, text).toBeLessThanOrEqual(LONGEST);
      }
    },
  );
});
