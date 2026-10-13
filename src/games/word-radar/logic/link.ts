import { hashSeed } from '../../shared/random';

/**
 * A seed written in the address (?seed=anything). Digits are the seed itself, which is what the
 * links made by the game contain; any other text is turned into a seed, so a readable word works
 * as well. Without a valid seed the game uses a fresh one.
 */
export function parseSeed(search: string, freshSeed: () => number): number {
  const text = new URLSearchParams(search).get('seed');
  if (text === null || text === '') {
    return freshSeed();
  }
  return /^\d{1,10}$/.test(text) ? Number(text) >>> 0 : hashSeed(text);
}

/** The address that opens the very same round (the same hidden word). */
export function buildRoundUrl(pageUrl: string, seed: number): string {
  return `${pageUrl}?seed=${String(seed >>> 0)}`;
}
