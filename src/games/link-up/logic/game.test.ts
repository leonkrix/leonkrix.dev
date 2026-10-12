import { describe, expect, it } from 'vitest';

import { createRandom, hashSeed } from '../../shared/random';
import { categories, conflicts } from '../data/index';
import {
  bestMatch,
  deselectAll,
  type Game,
  judge,
  MAX_MISTAKES,
  missingGroups,
  revealNext,
  shuffle,
  startGame,
  submit,
  toggle,
} from './game';
import { parseSeed } from './link';
import { generatePuzzle, GROUP_COUNT, GROUP_SIZE } from './puzzle';

const puzzle = generatePuzzle(categories, conflicts, createRandom('game-tests'));
const fresh = (): Game => startGame(puzzle, createRandom('order'));

/** The ids of a group of the puzzle */
const idsOf = (group: number): string[] =>
  puzzle.tiles.filter((tile) => tile.group === group).map((tile) => tile.id);

/** Picks the given tiles one after the other */
const pick = (game: Game, ids: readonly string[]): Game =>
  ids.reduce((current, id) => toggle(current, id), game);

/** Four tiles that belong to two groups (two of each): a wrong guess that is not one away */
const mixed = (): string[] => [...idsOf(0).slice(0, 2), ...idsOf(1).slice(0, 2)];

/** Three of one group and one of another: one away */
const oneAway = (): string[] => [...idsOf(0).slice(0, 3), ...idsOf(1).slice(0, 1)];

describe('starting a game', () => {
  it('shows all 16 tiles in a shuffled order, nothing picked, nothing found', () => {
    const game = fresh();
    expect([...game.order].sort()).toEqual(puzzle.tiles.map((tile) => tile.id).sort());
    expect(game.order).not.toEqual(puzzle.tiles.map((tile) => tile.id));
    expect(game).toMatchObject({ selected: [], solved: [], mistakes: 0, status: 'playing' });
  });
});

describe('picking tiles', () => {
  it('picks and puts back a tile, and never lets more than four be picked', () => {
    let game = fresh();
    const [first = '', ...others] = game.order;
    game = toggle(game, first);
    expect(game.selected).toEqual([first]);
    game = toggle(game, first);
    expect(game.selected).toEqual([]);
    game = pick(game, others.slice(0, 5));
    expect(game.selected).toHaveLength(GROUP_SIZE);
  });

  it('ignores a tile that is not on the board and anything after the game ended', () => {
    const game = fresh();
    expect(toggle(game, 'not a term')).toBe(game);
    expect(toggle({ ...game, status: 'won' }, game.order[0] ?? '')).toEqual({
      ...game,
      status: 'won',
    });
  });

  it('puts everything back with one move', () => {
    const game = pick(fresh(), idsOf(0).slice(0, 2));
    expect(deselectAll(game).selected).toEqual([]);
    const empty = fresh();
    expect(deselectAll(empty)).toBe(empty);
  });
});

describe('handing in a group', () => {
  it('does nothing until four tiles are picked', () => {
    const game = pick(fresh(), idsOf(0).slice(0, 3));
    expect(judge(game)).toBeNull();
    expect(submit(game)).toBe(game);
  });

  it('takes a correct group off the board and remembers the order in which groups were found', () => {
    let game = submit(pick(fresh(), idsOf(2)));
    expect(game.solved).toEqual([2]);
    expect(game.order).toHaveLength(12);
    expect(game.selected).toEqual([]);
    expect(game.last).toEqual({ kind: 'correct', group: 2 });
    expect(game.mistakes).toBe(0);
    game = submit(pick(game, idsOf(0)));
    expect(game.solved).toEqual([2, 0]);
  });

  it('counts a mistake for a wrong group, tells "one away", and clears the picks', () => {
    const wrong = submit(pick(fresh(), mixed()));
    expect(wrong.mistakes).toBe(1);
    expect(wrong.last).toEqual({ kind: 'wrong' });
    expect(wrong.selected).toEqual([]);
    expect(wrong.order).toHaveLength(16);
    const near = submit(pick(fresh(), oneAway()));
    expect(near.mistakes).toBe(1);
    expect(near.last).toEqual({ kind: 'oneAway' });
  });

  it('does not count the same wrong group twice', () => {
    let game = submit(pick(fresh(), mixed()));
    game = pick(game, [...mixed()].reverse());
    expect(judge(game)).toEqual({ kind: 'repeat' });
    game = submit(game);
    expect(game.mistakes).toBe(1);
    expect(game.last).toEqual({ kind: 'repeat' });
  });

  it('is won with the fourth group, with the mistakes that were made', () => {
    let game = submit(pick(fresh(), mixed()));
    for (let group = 0; group < GROUP_COUNT; group += 1) {
      game = submit(pick(game, idsOf(group)));
    }
    expect(game.status).toBe('won');
    expect(game.solved).toHaveLength(GROUP_COUNT);
    expect(game.order).toEqual([]);
    expect(game.mistakes).toBe(1);
  });

  it('is lost with the fourth mistake, and then shows the groups that were missing one by one', () => {
    let game = submit(pick(fresh(), idsOf(1)));
    // Four different wrong groups: the first one needs the groups 0, 2 and 3
    const others = [0, 2, 3].flatMap((group) => idsOf(group));
    const wrongs = [
      [others[0], others[1], others[4], others[5]],
      [others[0], others[1], others[8], others[9]],
      [others[4], others[5], others[8], others[9]],
      [others[2], others[3], others[6], others[7]],
    ];
    expect(wrongs).toHaveLength(MAX_MISTAKES);
    for (const ids of wrongs) {
      game = submit(pick(game, ids as string[]));
    }
    expect(game.status).toBe('lost');
    expect(game.mistakes).toBe(MAX_MISTAKES);
    expect(missingGroups(game)).toEqual([0, 2, 3]);
    game = revealNext(game);
    expect(game.revealed).toEqual([0]);
    expect(game.order).toHaveLength(8);
    game = revealNext(revealNext(game));
    expect(game.revealed).toEqual([0, 2, 3]);
    expect(game.order).toEqual([]);
    expect(revealNext(game)).toBe(game);
  });
});

describe('the best match', () => {
  it('is the largest number of picked tiles from one group', () => {
    const game = fresh();
    expect(bestMatch(game, idsOf(0))).toBe(4);
    expect(bestMatch(game, oneAway())).toBe(3);
    expect(bestMatch(game, mixed())).toBe(2);
  });
});

describe('shuffling', () => {
  it('keeps the same tiles in another order, and the picks', () => {
    const game = pick(fresh(), idsOf(0).slice(0, 2));
    const shuffled = shuffle(game, createRandom('again'));
    expect([...shuffled.order].sort()).toEqual([...game.order].sort());
    expect(shuffled.order).not.toEqual(game.order);
    expect(shuffled.selected).toEqual(game.selected);
  });
});

describe('the seed in the address', () => {
  it('reads digits as the seed, other text as a readable seed, and uses a fresh one without', () => {
    const fallback = (): number => 7;
    expect(parseSeed('?seed=123', fallback)).toBe(123);
    expect(parseSeed('?seed=hello', fallback)).toBe(hashSeed('hello'));
    expect(parseSeed('', fallback)).toBe(7);
    expect(parseSeed('?seed=', fallback)).toBe(7);
  });
});
