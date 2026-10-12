import { type Random } from '../../shared/random';
import { GROUP_COUNT, GROUP_SIZE, type Puzzle } from './puzzle';

/** How many wrong groups a player may hand in: with the fourth one the game is lost. */
export const MAX_MISTAKES = 4;

export type Status = 'playing' | 'won' | 'lost';

/** What the last attempt was, so that the screen can react to it. */
export type Outcome =
  { kind: 'correct'; group: number } | { kind: 'wrong' } | { kind: 'oneAway' } | { kind: 'repeat' };

/**
 * A game as a value that is never changed: every move gives a new one. The tiles are told apart by
 * their id (the name of the term).
 */
export interface Game {
  puzzle: Puzzle;
  /** The tiles that are still on the board, in the order they are shown */
  order: readonly string[];
  /** The tiles the player has picked, at most four, in the order of picking */
  selected: readonly string[];
  /** The groups that were found, in the order they were found */
  solved: readonly number[];
  /** The groups that the game showed after the player ran out of tries */
  revealed: readonly number[];
  mistakes: number;
  /** The groups that were tried and were wrong, as sorted lists of ids (trying again costs nothing) */
  tried: readonly string[];
  status: Status;
  last: Outcome | null;
}

/** A new game with the tiles in a shuffled order. */
export function startGame(puzzle: Puzzle, random: Random): Game {
  return {
    puzzle,
    order: random.shuffle(puzzle.tiles.map((tile) => tile.id)),
    selected: [],
    solved: [],
    revealed: [],
    mistakes: 0,
    tried: [],
    status: 'playing',
    last: null,
  };
}

/** The group of a tile, from its id. */
function groupOf(game: Game, id: string): number {
  return game.puzzle.tiles.find((tile) => tile.id === id)?.group ?? -1;
}

/** Picks a tile, or puts it back when it is picked already. At most four can be picked. */
export function toggle(game: Game, id: string): Game {
  if (game.status !== 'playing' || !game.order.includes(id)) {
    return game;
  }
  if (game.selected.includes(id)) {
    return { ...game, selected: game.selected.filter((other) => other !== id), last: null };
  }
  if (game.selected.length >= GROUP_SIZE) {
    return game;
  }
  return { ...game, selected: [...game.selected, id], last: null };
}

export function deselectAll(game: Game): Game {
  return game.selected.length === 0 ? game : { ...game, selected: [], last: null };
}

/** The tiles that are left, in a new shuffled order. */
export function shuffle(game: Game, random: Random): Game {
  return { ...game, order: random.shuffle(game.order) };
}

/** How many of the picked tiles belong together at most (4 is a correct group). */
export function bestMatch(game: Game, ids: readonly string[]): number {
  const counts = new Array<number>(GROUP_COUNT).fill(0);
  for (const id of ids) {
    const group = groupOf(game, id);
    counts[group] = (counts[group] ?? 0) + 1;
  }
  return Math.max(...counts);
}

/** The outcome of handing in the picked tiles, without changing anything. */
export function judge(game: Game): Outcome | null {
  if (game.status !== 'playing' || game.selected.length !== GROUP_SIZE) {
    return null;
  }
  const best = bestMatch(game, game.selected);
  if (best === GROUP_SIZE) {
    return { kind: 'correct', group: groupOf(game, game.selected[0] ?? '') };
  }
  if (game.tried.includes(attemptKey(game.selected))) {
    return { kind: 'repeat' };
  }
  return best === GROUP_SIZE - 1 ? { kind: 'oneAway' } : { kind: 'wrong' };
}

function attemptKey(ids: readonly string[]): string {
  return [...ids].sort().join('|');
}

/** Hands in the four picked tiles. */
export function submit(game: Game): Game {
  const outcome = judge(game);
  if (outcome === null) {
    return game;
  }
  if (outcome.kind === 'correct') {
    const solved = [...game.solved, outcome.group];
    const order = game.order.filter((id) => !game.selected.includes(id));
    return {
      ...game,
      order,
      selected: [],
      solved,
      status: solved.length === GROUP_COUNT ? 'won' : 'playing',
      last: outcome,
    };
  }
  if (outcome.kind === 'repeat') {
    return { ...game, selected: [], last: outcome };
  }
  const mistakes = game.mistakes + 1;
  const lost = mistakes >= MAX_MISTAKES;
  return {
    ...game,
    selected: [],
    mistakes,
    tried: [...game.tried, attemptKey(game.selected)],
    status: lost ? 'lost' : 'playing',
    last: outcome,
  };
}

/** The groups that are not found yet, in the order they were made. */
export function missingGroups(game: Game): number[] {
  return Array.from({ length: GROUP_COUNT }, (_, group) => group).filter(
    (group) => !game.solved.includes(group) && !game.revealed.includes(group),
  );
}

/**
 * After the last mistake the game shows the groups that were not found, one after the other. This
 * moves the next one from the board to the revealed groups.
 */
export function revealNext(game: Game): Game {
  const [next] = missingGroups(game);
  if (game.status !== 'lost' || next === undefined) {
    return game;
  }
  const tiles = new Set(
    game.puzzle.tiles.filter((tile) => tile.group === next).map((tile) => tile.id),
  );
  return {
    ...game,
    order: game.order.filter((id) => !tiles.has(id)),
    selected: game.selected.filter((id) => !tiles.has(id)),
    revealed: [...game.revealed, next],
  };
}
