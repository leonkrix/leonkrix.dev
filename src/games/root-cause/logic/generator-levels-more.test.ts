// The tests of generator.test.ts, split into files that run side by side (every test is the same, only the files are more): the other tests of generateLevel

import { describe, expect, it } from 'vitest';

import { caseFile } from '../data/skins';
import { isNeutral } from './clues';
import { generateLevel, isVaried } from './generator';
import { defined, SKINS, SLOW } from './generator-test-helpers';
import { type Tier } from './types';

describe('generateLevel, more', () => {
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
