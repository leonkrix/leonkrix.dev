import { describe, expect, it } from 'vitest';

import levelsJson from './data/levels.json';
import { LEVEL_PLAN, minRoomsOf } from './data/pool-plan';
import { STORIES } from './data/stories';
import { subjectOf } from './logic/clues';
import { problemsOf, tierOf } from './logic/generator';
import { rate } from './logic/propagation';
import { type Level, type Tier } from './logic/types';
import { type LevelRecord, toLevel } from './pool';

const records = levelsJson as unknown as LevelRecord[];

/** The hardest reasoning a tier may ask for */
const MAX_REASONING: Readonly<Record<Tier, number>> = { easy: 1, medium: 2, hard: 3 };

describe('the level pool', () => {
  it('has exactly the levels of the plan, in order', () => {
    expect(records.map((record) => record.id)).toEqual(LEVEL_PLAN.map((plan) => plan.id));
    for (const plan of LEVEL_PLAN) {
      const record = records.find((entry) => entry.id === plan.id);
      expect(record?.skin, plan.id).toBe(plan.skin);
      expect(record?.tier, plan.id).toBe(plan.tier);
      expect(record?.size, plan.id).toBe(plan.size);
      expect(record?.people.at(-1)?.role, plan.id).toBe(plan.victim);
    }
  });

  it('is three tiers of six levels, both skins in every tier, growing within a tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const ofTier = records.filter((record) => record.tier === tier);
      expect(ofTier).toHaveLength(6);
      expect(new Set(ofTier.map((record) => record.skin)).size).toBe(2);
      const sizes = ofTier.map((record) => record.size);
      expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    }
  });

  it('gives every level a title and a story, and nothing else has one', () => {
    expect(Object.keys(STORIES).sort()).toEqual(records.map((record) => record.id).sort());
    for (const { title, story } of Object.values(STORIES)) {
      expect(title.length).toBeGreaterThan(2);
      expect(story.length).toBeGreaterThan(40);
    }
    expect(new Set(Object.values(STORIES).map((entry) => entry.title)).size).toBe(records.length);
  });

  it('never names a room or a kind of room in a story, and never says the culprit was alone', () => {
    const rooms =
      /b(office|meeting room|break room|server room|lab|archive|reception|corridor|network closet|closet|data hall|hall|ups room|cabling room|edge site|cooling room)b/i;
    for (const [id, { title, story }] of Object.entries(STORIES)) {
      expect(`${title} ${story}`, id).not.toMatch(rooms);
      expect(story, id).not.toMatch(/baloneb/i);
    }
  });

  it('names the victim of the plan in the story when it is a device', () => {
    for (const plan of LEVEL_PLAN) {
      const victim = records.find((record) => record.id === plan.id)?.people.at(-1)?.name ?? '';
      const story = STORIES[plan.id]?.story ?? '';
      if (plan.skin === 'outage') {
        expect(story, plan.id).toContain(victim);
      }
    }
  });

  it('has no two equal maps', () => {
    const maps = records.map((record) => JSON.stringify(record.layout));
    expect(new Set(maps).size).toBe(maps.length);
  });

  it('stays small: it is loaded in one piece by the game page', () => {
    expect(JSON.stringify(levelsJson).length).toBeLessThan(60_000);
  });

  describe.each(records)('level $id', (record) => {
    const level: Level = toLevel(record);

    it('passes the checks of the generator: both solvers find exactly the stored solution', () => {
      expect(problemsOf(level)).toEqual([]);
    }, 60_000);

    it('has the difficulty of its tier and enough rooms', () => {
      expect(tierOf(rate(level))).toBe(record.tier);
      expect(level.layout.roomCount).toBeGreaterThanOrEqual(minRoomsOf(record.size));
    });

    it('has no clue that could be taken away', () => {
      level.clues.forEach((clue, index) => {
        const clues = level.clues.filter((_, other) => other !== index);
        const subject = subjectOf(clue);
        // A suspect keeps at least one clue, so the only clue of a suspect stays whatever it does
        if (subject !== undefined && !clues.some((other) => subjectOf(other) === subject)) {
          return;
        }
        const rating = rate({ ...level, clues });
        const stillEnough =
          rating.solved && rating.level <= MAX_REASONING[record.tier] && rating.level !== 4;
        expect(stillEnough, `clue ${String(index)} (${clue.type}) is not needed`).toBe(false);
      });
    }, 60_000);
  });
});
