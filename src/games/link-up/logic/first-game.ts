import { freshSeed } from '../../shared/random';
import { type Game } from './game';
import { parseSeed } from './link';
import { newGame } from './new-game';

let first: Promise<{ seed: number; game: Game }> | undefined;

/**
 * The first puzzle of the page, made once. A small script of the page starts it as soon as the page
 * has loaded, so the files with the words are fetched while the game itself (React and the board)
 * is still loading; the game then picks up the same promise.
 */
export function firstGame(): Promise<{ seed: number; game: Game }> {
  first ??= (async () => {
    const seed = parseSeed(window.location.search, freshSeed);
    return { seed, game: await newGame(seed) };
  })();
  return first;
}
