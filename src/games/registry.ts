/**
 * The list of games of the Playground (see PLAN.md, Phase 4).
 *
 * A game is merged as `hidden` while it is built and set to `live` in the pull request that
 * completes it. Only live games get a page, a tile, a navigation entry and a sitemap entry; with no
 * live game the site looks exactly as if the Playground did not exist.
 *
 * Pure data and functions, no imports from the site, so tests and scripts can use it directly.
 */

export type GameTag = 'Words' | 'Logic' | 'ML' | 'Network';

export type GameStatus = 'hidden' | 'live';

export interface GameDefinition {
  /** Lowercase words joined by hyphens. Used for the address and the folder `src/games/<slug>/`. */
  slug: string;
  name: string;
  tag: GameTag;
  /** One line for the tile and the page description. */
  description: string;
  /** Fallback tile icon in the form "<set>:<name>", see Icon.astro */
  icon: string;
  status: GameStatus;
}

export const games: readonly GameDefinition[] = [
  {
    slug: 'tech-words',
    name: 'Tech Words',
    tag: 'Words',
    description: 'Guess the hidden tech term in six tries.',
    icon: 'lucide:spell-check',
    status: 'live',
  },
  {
    slug: 'root-cause',
    name: 'Root Cause',
    tag: 'Logic',
    description: 'A logic puzzle: work out who was alone with the victim.',
    icon: 'lucide:search',
    status: 'hidden',
  },
  {
    slug: 'word-radar',
    name: 'Word Radar',
    tag: 'ML',
    description: 'Find the secret word by how close your guesses are in meaning.',
    icon: 'lucide:radar',
    status: 'hidden',
  },
  {
    slug: 'link-up',
    name: 'Link Up',
    tag: 'Words',
    description: 'Sort sixteen terms into four hidden groups.',
    icon: 'lucide:link',
    status: 'hidden',
  },
];

/** Address of the overview page. */
export const gamesPath = '/games/';

export function gamePath(slug: string): string {
  return `${gamesPath}${slug}/`;
}

export function liveGames(list: readonly GameDefinition[] = games): readonly GameDefinition[] {
  return list.filter((game) => game.status === 'live');
}

/** Pages that exist for the given games: the overview and one page per live game, or none. */
export function gamePaths(list: readonly GameDefinition[] = games): readonly string[] {
  const live = liveGames(list);
  return live.length === 0 ? [] : [gamesPath, ...live.map((game) => gamePath(game.slug))];
}
