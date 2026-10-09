import { describe, expect, it } from 'vitest';

import { createRandom } from '../../shared/random';
import { caseFile, outage } from '../data/skins';
import { Board } from './board';
import { clueLevelOf, type Context, isNeutral, isSolution, subjectOf } from './clues';
import {
  chooseClues,
  enumerateClues,
  generateLevel,
  isVaried,
  makePeople,
  problemsOf,
  sampleSolution,
  tierOf,
} from './generator';
import { generateLayout } from './layout';
import { rate } from './propagation';
import { kindsOf, type Skin } from './skin';
import { solve } from './solver';
import { type Clue, type Tier } from './types';

const SKINS: readonly Skin[] = [caseFile, outage];

/** Generating takes a moment: these tests get more time than the usual five seconds */
const SLOW = 120_000;

/** A value the test cannot go on without: fails with a clear message when it is missing */
function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error('Expected ' + what + ', but there was none');
  }
  return value;
}

describe('makePeople', () => {
  it.each(SKINS)('gives $id people unique names and labels, the victim last', (skin) => {
    for (const size of [4, 5, 6, 7, 8, 9]) {
      for (let seed = 0; seed < 30; seed += 1) {
        const people = makePeople(
          skin,
          size,
          createRandom(`${skin.id}-${String(size)}-${String(seed)}`),
        );
        expect(people).toHaveLength(size);
        expect(new Set(people.map((person) => person.name)).size).toBe(size);
        expect(new Set(people.map((person) => person.label)).size).toBe(size);
        const victimRole = people.at(-1)?.role ?? '';
        expect(skin.victimRoles).toContain(victimRole);
        for (const person of people.slice(0, -1)) {
          expect(skin.roles).toContain(person.role);
          expect(person.role).not.toBe(victimRole);
        }
      }
    }
  });

  it('numbers devices by type: sw-01, sw-02, fw-01, and the server last', () => {
    const people = makePeople(outage, 9, createRandom('devices'), 'server');
    const byRole = new Map<string, string[]>();
    for (const person of people) {
      byRole.set(person.role, [...(byRole.get(person.role) ?? []), person.name]);
    }
    for (const names of byRole.values()) {
      names.forEach((name, index) => {
        expect(name).toMatch(new RegExp(`^[a-z]+-0${String(index + 1)}$`));
      });
    }
    expect(people.at(-1)?.name).toBe('srv-01');
  });

  it('gives the victim the wanted role, or a random one, and the suspects never the same', () => {
    expect(makePeople(caseFile, 6, createRandom('v'), 'developer').at(-1)?.role).toBe('developer');
    const db = makePeople(outage, 7, createRandom('v'), 'database');
    expect(db.at(-1)?.name).toBe('db-01');
    expect(db.slice(0, -1).some((person) => person.role === 'database')).toBe(false);
    const seen = new Set(
      Array.from(
        { length: 80 },
        (_, seed) => makePeople(caseFile, 5, createRandom(`victim-${String(seed)}`)).at(-1)?.role,
      ),
    );
    expect(seen.size).toBeGreaterThan(4);
    expect(() => makePeople(caseFile, 5, createRandom(1), 'router')).toThrow(RangeError);
  });

  it('uses first names with the first letter as the label in Case file', () => {
    for (const person of makePeople(caseFile, 9, createRandom('names'))) {
      expect(person.label).toBe(person.name.charAt(0));
    }
  });

  it('is the same for the same seed', () => {
    expect(makePeople(caseFile, 6, createRandom('x'))).toEqual(
      makePeople(caseFile, 6, createRandom('x')),
    );
  });
});

describe('sampleSolution', () => {
  it.each(SKINS)(
    'puts one person in every row and column, never on a blocked cell, for $id',
    (skin) => {
      for (const size of [4, 6, 9]) {
        let found = 0;
        for (let seed = 0; seed < 20; seed += 1) {
          const random = createRandom(`${skin.id}-${String(size)}-${String(seed)}`);
          const layout = generateLayout(skin, size, 'medium', random);
          const board = new Board(layout, kindsOf(skin));
          const solution = sampleSolution(board, random);
          // A few maps have no good solution at all (the generator then takes another)
          if (solution === undefined) {
            continue;
          }
          found += 1;
          expect(new Set(solution.map((cell) => board.row(cell))).size).toBe(size);
          expect(new Set(solution.map((cell) => board.col(cell))).size).toBe(size);
          expect(solution.some((cell) => board.blocked.has(cell))).toBe(false);
          // The victim, the last one, is alone with exactly one suspect
          const victimRoom = board.roomOf[solution.at(-1) ?? 0];
          expect(
            solution.slice(0, -1).filter((cell) => board.roomOf[cell] === victimRoom),
          ).toHaveLength(1);
        }
        expect(found, `solutions for ${String(size)} by ${String(size)}`).toBeGreaterThanOrEqual(
          10,
        );
      }
    },
  );
});

describe('enumerateClues and chooseClues', () => {
  const skin = caseFile;
  const random = createRandom('clues');
  const layout = generateLayout(skin, 6, 'hard', random);
  const kinds = kindsOf(skin);
  const board = new Board(layout, kinds);
  const solution = sampleSolution(board, random) ?? [];
  const people = makePeople(skin, 6, random);
  const context: Context = { board, people, victim: 5 };
  const clues = (level: 1 | 2 | 3): Clue[] =>
    enumerateClues(context, layout, kinds, solution, level, createRandom('enumerate'));

  it('lists only clues that are true for the solution', () => {
    const all = clues(3);
    expect(all.length).toBeGreaterThan(150);
    for (const clue of all) {
      expect(isSolution([clue], context, solution), JSON.stringify(clue)).toBe(true);
    }
  });

  it('has clues about the suspects and about the map, and combinations', () => {
    const types = new Set(clues(3).map((clue) => clue.type));
    for (const type of [
      'inRoom',
      'relativeToKind',
      'kindInLine',
      'roomHasKind',
      'and',
      'or',
      'kindCount',
    ] as const) {
      expect(types.has(type), type).toBe(true);
    }
    expect(clues(3).some(isNeutral)).toBe(true);
  });

  it('keeps to the level that was asked for', () => {
    for (const level of [1, 2, 3] as const) {
      for (const clue of clues(level)) {
        expect(clueLevelOf(clue), clue.type).toBeLessThanOrEqual(level);
      }
    }
    // There are more to choose from at a higher level
    expect(clues(3).length).toBeGreaterThan(clues(1).length);
  });

  it('never mentions the victim, and no suspect clue is about the victim', () => {
    for (const clue of clues(3)) {
      expect(subjectOf(clue)).not.toBe(5);
      expect(JSON.stringify(clue)).not.toMatch(/"(person|other|third)":5\b/);
      expect(JSON.stringify(clue)).not.toMatch(/"persons":\[[^\]]*\b5\b/);
    }
  });

  it('chooses a unique set in which every suspect has a clue and nothing is left over', () => {
    const chosen = chooseClues(
      { layout, kinds, people, context },
      clues(3),
      createRandom('choose'),
      3,
    );
    expect(chosen).toBeDefined();
    const picked = chosen ?? [];
    expect(solve({ layout, kinds, people, clues: picked }).count).toBe(1);
    for (let person = 0; person < 5; person += 1) {
      expect(
        picked.some((clue) => subjectOf(clue) === person),
        `suspect ${String(person)}`,
      ).toBe(true);
    }
    // Needed: without any single clue the puzzle can no longer be solved, unless the suspect
    // would be left without a clue
    for (const clue of picked) {
      const rest = picked.filter((other) => other !== clue);
      const subject = subjectOf(clue);
      const only = subject !== undefined && !rest.some((other) => subjectOf(other) === subject);
      if (!only) {
        const rating = rate({ layout, kinds, people, clues: rest });
        expect(rating.solved && rating.level <= 3, JSON.stringify(clue)).toBe(false);
      }
    }
  });

  it('wants the number of clues about the map, and never more than it may', () => {
    const results = [0, 1, 2, 3, 4, 5].flatMap((seed) => {
      const chosen = chooseClues(
        { layout, kinds, people, context },
        clues(3),
        createRandom(`floor-${String(seed)}`),
        3,
        1,
        3,
      );
      return chosen === undefined ? [] : [chosen.filter(isNeutral).length];
    });
    // Some tries cannot keep a clue about the map (then no level is made from them), the others do
    expect(results.length).toBeGreaterThan(0);
    for (const floor of results) {
      expect(floor).toBeGreaterThanOrEqual(1);
      expect(floor).toBeLessThanOrEqual(3);
    }
  });
});

describe('isVaried', () => {
  const corner = (person: number): Clue => ({ type: 'corner', person });
  const other = (person: number): Clue => ({ type: 'windowFront', person });
  const third = (person: number): Clue => ({ type: 'onFurniture', person });

  it('accepts a few clues of any kind, and mixed clues', () => {
    expect(isVaried([corner(0), corner(1), corner(2)])).toBe(true);
    expect(isVaried([corner(0), other(1), third(2), corner(3), other(4), third(0)])).toBe(true);
  });

  it('wants at least three kinds in a level of four or more clues', () => {
    expect(isVaried([corner(0), corner(1), other(2), other(3)])).toBe(false);
  });

  it('does not let one kind take up more than a third of six or more clues', () => {
    expect(isVaried([corner(0), corner(1), corner(2), other(3), third(4), other(0)])).toBe(false);
    expect(isVaried([corner(0), corner(1), other(2), other(3), third(4), third(0)])).toBe(true);
  });

  it('does not let the hardest clues take up more than 40 percent', () => {
    const hard = (person: number): Clue => ({ type: 'distance', person, other: 1, distance: 2 });
    const hardTwo = (person: number): Clue => ({
      type: 'between',
      person,
      other: 1,
      third: 2,
      axis: 'row',
    });
    expect(isVaried([hard(0), hardTwo(1), hardTwo(2), corner(2), other(3), third(4)])).toBe(false);
    expect(isVaried([hard(0), corner(2), other(3), third(4), third(1)])).toBe(true);
  });
});

describe('tierOf', () => {
  it('takes the harder of the reasoning and the clues, and none for a puzzle that is too hard', () => {
    expect(tierOf({ solved: true, level: 1, clueLevel: 1 })).toBe('easy');
    expect(tierOf({ solved: true, level: 2, clueLevel: 1 })).toBe('medium');
    expect(tierOf({ solved: true, level: 1, clueLevel: 2 })).toBe('medium');
    expect(tierOf({ solved: true, level: 3, clueLevel: 1 })).toBe('hard');
    expect(tierOf({ solved: true, level: 2, clueLevel: 3 })).toBe('hard');
    expect(tierOf({ solved: false, level: 4, clueLevel: 1 })).toBeUndefined();
    expect(tierOf({ solved: true, level: 4, clueLevel: 1 })).toBeUndefined();
  });
});

describe('generateLevel', () => {
  const cases: { skin: Skin; size: number; tier: Tier }[] = SKINS.flatMap((skin) =>
    [
      { size: 4, tier: 'easy' as const },
      { size: 5, tier: 'easy' as const },
      { size: 5, tier: 'medium' as const },
      { size: 6, tier: 'medium' as const },
      { size: 4, tier: 'hard' as const },
      { size: 6, tier: 'hard' as const },
    ].map((entry) => ({ skin, ...entry })),
  );

  it.each(cases)(
    'makes verified $tier puzzles of $size by $size in $skin.id',
    ({ skin, size, tier }) => {
      for (let seed = 0; seed < 3; seed += 1) {
        const made = generateLevel(
          skin,
          size,
          tier,
          `test2-${skin.id}-${String(size)}-${tier}-${String(seed)}`,
        );
        const level = defined(made, `a level (seed ${String(seed)})`).level;
        // Two independent solvers, structure, names, clues: nothing may be wrong
        expect(problemsOf(level), `seed ${String(seed)}`).toEqual([]);
        expect(made?.tier).toBe(tier);
        expect(tierOf(rate(level))).toBe(tier);
        expect(level.people).toHaveLength(size);
        expect(level.layout.size).toBe(size);
        expect(level.layout.rooms).toHaveLength(level.layout.roomCount);
      }
    },
    SLOW,
  );

  it(
    'uses the number of clues about the map that the tier allows',
    () => {
      const limits: Record<Tier, [number, number]> = { easy: [0, 1], medium: [0, 2], hard: [1, 3] };
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        for (let seed = 0; seed < 4; seed += 1) {
          const made = defined(
            generateLevel(caseFile, 5, tier, `floor-${tier}-${String(seed)}`),
            'a level',
          );
          const floor = made.level.clues.filter(isNeutral).length;
          const [fewest, most] = limits[tier];
          expect(floor, `${tier} ${String(seed)}`).toBeGreaterThanOrEqual(fewest);
          expect(floor, `${tier} ${String(seed)}`).toBeLessThanOrEqual(most);
        }
      }
    },
    SLOW,
  );

  it(
    'makes the same puzzle for the same seed, and another one for another seed',
    () => {
      const first = generateLevel(caseFile, 5, 'medium', 'repeat');
      const again = generateLevel(caseFile, 5, 'medium', 'repeat');
      const other = generateLevel(caseFile, 5, 'medium', 'different');
      expect(first?.level).toEqual(again?.level);
      expect(first?.level).not.toEqual(other?.level);
    },
    SLOW,
  );

  it(
    'uses few clues: clues are rare',
    () => {
      for (const skin of SKINS) {
        const made = generateLevel(skin, 6, 'medium', 'rare');
        expect(made?.level.clues.length ?? 99).toBeLessThanOrEqual(14);
      }
    },
    SLOW,
  );

  it(
    'mixes the kinds of clues',
    () => {
      for (let seed = 0; seed < 6; seed += 1) {
        const clues =
          generateLevel(caseFile, 6, 'medium', `variety-${String(seed)}`)?.level.clues ?? [];
        expect(isVaried(clues), `seed ${String(seed)}`).toBe(true);
      }
    },
    SLOW,
  );

  it(
    'gives the rooms names that belong to their objects: no plant in a server room',
    () => {
      for (let seed = 0; seed < 8; seed += 1) {
        const level = defined(
          generateLevel(caseFile, 6, 'medium', `fit-${String(seed)}`),
          'a level',
        ).level;
        for (const object of level.layout.objects) {
          for (const cell of object.cells) {
            const room = level.layout.rooms[level.layout.roomOf[cell] ?? 0];
            if (room?.type === 'server-room') {
              expect(['plant', 'sofa', 'rug']).not.toContain(object.kind);
            }
          }
        }
      }
    },
    SLOW,
  );
});

describe('problemsOf notices a level that is wrong', () => {
  const made = generateLevel(caseFile, 5, 'medium', 'wrong');
  const level = defined(made, 'a level').level;

  it('accepts a good level', () => {
    expect(problemsOf(level)).toEqual([]);
  });

  it('notices a missing clue that makes the puzzle ambiguous', () => {
    const fewer = { ...level, clues: level.clues.slice(0, -2) };
    expect(problemsOf(fewer).join('\n')).toMatch(/solver finds/);
  });

  it('notices a solution that breaks a clue', () => {
    const wrong = { ...level, solution: [...level.solution].reverse() };
    expect(problemsOf(wrong).length).toBeGreaterThan(0);
  });

  it('notices a label that is used twice, and a missing clue for a suspect', () => {
    const people = level.people.map((person, index) =>
      index === 1 ? { ...person, label: level.people[0]?.label ?? '' } : person,
    );
    expect(problemsOf({ ...level, people })).toContain('a label is used twice');
    const nobody = level.clues.filter((clue) => subjectOf(clue) !== 0);
    expect(problemsOf({ ...level, clues: nobody }).join('\n')).toMatch(/has no clue/);
  });

  it('notices a clue about the victim, and a clue that names the victim', () => {
    const victim = level.people.length - 1;
    const about = {
      ...level,
      clues: [...level.clues, { type: 'corner' as const, person: victim }],
    };
    expect(problemsOf(about)).toContain('a clue is about the victim or names the victim');
    const names = {
      ...level,
      clues: [...level.clues, { type: 'sameRoom' as const, person: 0, other: victim }],
    };
    expect(problemsOf(names)).toContain('a clue is about the victim or names the victim');
  });

  it('notices a room name that is used twice', () => {
    const rooms = level.layout.rooms.map((room) => ({ ...room, name: 'Lab' }));
    expect(problemsOf({ ...level, layout: { ...level.layout, rooms } })).toContain(
      'a room name is used twice',
    );
  });

  it('notices the wrong number of people', () => {
    expect(problemsOf({ ...level, people: level.people.slice(1) })[0]).toMatch(/number of people/);
  });
});
