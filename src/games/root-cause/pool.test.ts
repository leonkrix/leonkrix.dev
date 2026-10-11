import { describe, expect, it } from 'vitest';

import levelsJson from './data/levels.json';
import { LEVEL_PLAN, minRoomsOf } from './data/pool-plan';
import { STORIES } from './data/stories';
import { Board } from './logic/board';
import { check, type Context, isStatic, subjectOf, UNPLACED } from './logic/clues';
import {
  axesOf,
  axisSubjects,
  directShare,
  nakedShare,
  problemsOf,
  tierOf,
} from './logic/generator';
import { directlySolved, nakedSolved, rate } from './logic/propagation';
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

    it('opens the way it should: a medium level is placed half by the clues alone', () => {
      if (record.tier === 'medium') {
        expect(directlySolved(level)).toBeGreaterThanOrEqual(directShare('medium', record.size));
      }
    });

    it('opens the way it should: an easy level needs nothing but a person with one cell left', () => {
      if (record.tier === 'easy') {
        expect(nakedSolved(level)).toBe(nakedShare('easy', record.size));
      }
    });

    it('never has a row and a column clue about the same person', () => {
      const { row, col } = axisSubjects(level.clues);
      expect(row.filter((person) => col.includes(person))).toEqual([]);
    });

    it('has at most one clue about a row and one about a column', () => {
      const axes = level.clues.flatMap((clue) => axesOf(clue));
      expect(axes.filter((axis) => axis === 'row').length).toBeLessThanOrEqual(1);
      expect(axes.filter((axis) => axis === 'col').length).toBeLessThanOrEqual(1);
    });

    it('has no clue that says nothing, and no combination with a part that adds nothing', () => {
      const board = new Board(level.layout, level.kinds);
      const context: Context = { board, people: level.people, victim: level.people.length - 1 };
      const free = Array.from({ length: board.cellCount }, (_, cell) => cell).filter(
        (cell) => !board.blocked.has(cell),
      );
      const cellsOf = (clue: Parameters<typeof isStatic>[0]): Set<number> | undefined => {
        const person = subjectOf(clue);
        if (person === undefined || !isStatic(clue)) {
          return undefined;
        }
        return new Set(
          free.filter(
            (cell) =>
              check(
                clue,
                context,
                level.people.map((_, other) => (other === person ? cell : UNPLACED)),
              ) === true,
          ),
        );
      };
      for (const clue of level.clues) {
        if (clue.type === 'and' || clue.type === 'or') {
          const a = cellsOf(clue.parts[0]);
          const b = cellsOf(clue.parts[1]);
          if (a !== undefined && b !== undefined) {
            const both = [...a].filter((cell) => b.has(cell)).length;
            expect(both, `${clue.type}: a part follows from the other`).toBeLessThan(a.size);
            expect(both, `${clue.type}: a part follows from the other`).toBeLessThan(b.size);
          }
        } else {
          const cells = cellsOf(clue);
          if (cells !== undefined) {
            expect(cells.size, `${clue.type} says nothing`).toBeLessThan(free.length);
          }
        }
      }
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
        // A clue is also needed when the level would no longer open the way its tier wants
        const stillEnough =
          rating.solved &&
          rating.level <= MAX_REASONING[record.tier] &&
          rating.level !== 4 &&
          directlySolved({ ...level, clues }) >= directShare(record.tier, record.size) &&
          nakedSolved({ ...level, clues }) >= nakedShare(record.tier, record.size);
        expect(stillEnough, `clue ${String(index)} (${clue.type}) is not needed`).toBe(false);
      });
    }, 60_000);
  });
});
