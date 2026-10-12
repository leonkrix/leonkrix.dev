import { createRandom } from '../../shared/random';
import { catalog } from '../data/catalog';
import { conflicts } from '../data/conflicts';
import { loadCategories } from '../data/load';
import { type Game, startGame } from './game';
import { generatePuzzleLazily } from './puzzle';

/**
 * A new game from a seed: the same seed always gives the same puzzle and the same first order. The
 * files with the four categories of the puzzle are fetched first, if they are not there yet.
 */
export async function newGame(seed: number): Promise<Game> {
  const puzzle = await generatePuzzleLazily(
    catalog.map(([id]) => ({ id })),
    conflicts,
    loadCategories,
    createRandom(seed),
  );
  return startGame(puzzle, createRandom(seed ^ 0x9e3779b9));
}
