import { describe, expect, it } from 'vitest';

import { createRandom } from '../../shared/random';
import { type Category } from '../data/define';
import { categories, conflicts } from '../data/index';
import {
  conflictKeys,
  countSolutions,
  generatePuzzle,
  generatePuzzleLazily,
  GROUP_COUNT,
  GROUP_SIZE,
  pairKey,
  type Puzzle,
  TILE_COUNT,
} from './puzzle';

const small: Category[] = [
  {
    id: 'one',
    name: 'One',
    description: 'First.',
    terms: ['a', 'b', 'c', 'd', 'e'].map((name) => ({ name, definition: 'x' })),
  },
  {
    id: 'two',
    name: 'Two',
    description: 'Second.',
    terms: ['f', 'g', 'h', 'i', 'j'].map((name) => ({ name, definition: 'x' })),
  },
  {
    id: 'three',
    name: 'Three',
    description: 'Third.',
    terms: ['k', 'l', 'm', 'n', 'o'].map((name) => ({ name, definition: 'x' })),
  },
  {
    id: 'four',
    name: 'Four',
    description: 'Fourth.',
    terms: ['p', 'q', 'r', 's', 't'].map((name) => ({ name, definition: 'x' })),
  },
];

describe('conflict keys', () => {
  it('are the same for both orders', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
    expect(conflictKeys([['b', 'a']]).has(pairKey('a', 'b'))).toBe(true);
  });
});

describe('counting the solutions of a puzzle', () => {
  const puzzleOf = (list: readonly Category[]): Puzzle => ({
    groups: list.map(({ id, name, description, terms }) => ({
      id,
      name,
      description,
      terms: terms.slice(0, GROUP_SIZE),
    })),
    tiles: list.flatMap((category, group) =>
      category.terms.slice(0, GROUP_SIZE).map((term) => ({
        id: term.name,
        name: term.name,
        definition: term.definition,
        group,
      })),
    ),
  });

  it('finds exactly one when every term has one category', () => {
    expect(countSolutions(puzzleOf(small), small)).toBe(1);
  });

  it('finds more than one when two terms fit each other’s group', () => {
    // Both groups also list a term of the other one (a in the second, f in the first), so that
    // a and f could swap places and the puzzle would have two answers
    const loose = small.map((category) => {
      if (category.id === 'one') {
        return { ...category, terms: [...category.terms, { name: 'f', definition: 'x' }] };
      }
      if (category.id === 'two') {
        return { ...category, terms: [...category.terms, { name: 'a', definition: 'x' }] };
      }
      return category;
    });
    expect(countSolutions(puzzleOf(small), loose)).toBe(2);
  });

  it('finds none when the data does not allow the groups at all', () => {
    const wrong = small.map((category) => ({ ...category, terms: [] }));
    expect(countSolutions(puzzleOf(small), wrong)).toBe(0);
  });
});

describe('making a puzzle', () => {
  it('gives four groups of four terms of four categories that may meet', () => {
    const blocked = conflictKeys(conflicts);
    for (let seed = 0; seed < 150; seed += 1) {
      const puzzle = generatePuzzle(categories, conflicts, createRandom(seed));
      expect(puzzle.groups).toHaveLength(GROUP_COUNT);
      expect(puzzle.tiles).toHaveLength(TILE_COUNT);
      expect(new Set(puzzle.tiles.map((tile) => tile.id)).size).toBe(TILE_COUNT);
      for (const [index, group] of puzzle.groups.entries()) {
        expect(group.terms).toHaveLength(GROUP_SIZE);
        expect(puzzle.tiles.filter((tile) => tile.group === index)).toHaveLength(GROUP_SIZE);
        for (const other of puzzle.groups.slice(index + 1)) {
          expect(blocked.has(pairKey(group.id, other.id)), `${group.id} ${other.id}`).toBe(false);
        }
      }
    }
  });

  it('has exactly one solution, every time (checked with the data, independent of how it was made)', () => {
    for (let seed = 0; seed < 150; seed += 1) {
      const puzzle = generatePuzzle(
        categories,
        conflicts,
        createRandom(`solution-${String(seed)}`),
      );
      expect(countSolutions(puzzle, categories), `seed ${String(seed)}`).toBe(1);
    }
  });

  it('is the same for the same seed and differs between seeds', () => {
    const first = generatePuzzle(categories, conflicts, createRandom('same'));
    const again = generatePuzzle(categories, conflicts, createRandom('same'));
    expect(again).toEqual(first);
    const ids = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      ids.add(
        generatePuzzle(categories, conflicts, createRandom(seed))
          .tiles.map((tile) => tile.id)
          .sort()
          .join('|'),
      );
    }
    expect(ids.size).toBeGreaterThan(35);
  });

  it('uses every category over many puzzles (none is left out because of the conflicts)', () => {
    const used = new Set<string>();
    for (let seed = 0; seed < 600; seed += 1) {
      for (const group of generatePuzzle(categories, conflicts, createRandom(`use-${String(seed)}`))
        .groups) {
        used.add(group.id);
      }
    }
    expect(used.size).toBe(categories.length);
  });

  it('fails clearly when the categories cannot meet at all', () => {
    const all = small.map((category) => category.id);
    const everything = all.flatMap((a, i) => all.slice(i + 1).map((b) => [a, b] as const));
    expect(() => generatePuzzle(small, everything, createRandom(1))).toThrow('No puzzle found');
  });
});

describe('generatePuzzleLazily', () => {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const load = async (ids: readonly string[]): Promise<Category[]> =>
    Promise.resolve(
      ids.map((id) => {
        const category = byId.get(id);
        if (category === undefined) {
          throw new Error(id);
        }
        return category;
      }),
    );

  it('makes exactly the puzzle of generatePuzzle for the same seed', async () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const lazy = await generatePuzzleLazily(categories, conflicts, load, createRandom(seed));
      expect(lazy).toEqual(generatePuzzle(categories, conflicts, createRandom(seed)));
    }
  });

  it('asks for four categories at a time, and for no others', async () => {
    const asked: string[][] = [];
    const spy = async (ids: readonly string[]): Promise<Category[]> => {
      asked.push([...ids]);
      return load(ids);
    };
    const puzzle = await generatePuzzleLazily(categories, conflicts, spy, createRandom(7));
    expect(asked.length).toBeGreaterThan(0);
    for (const ids of asked) {
      expect(ids).toHaveLength(GROUP_COUNT);
    }
    expect(asked.at(-1)).toEqual(puzzle.groups.map((group) => group.id));
  });
});
