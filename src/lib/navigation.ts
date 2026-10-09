import { type GameDefinition, liveGames } from '../games/registry';

export interface NavLink {
  label: string;
  /** Points to a section on the home page. The leading "/" makes it work from every page. */
  href: `/#${string}`;
}

/**
 * The header links, in page order. The Playground entry exists only while at least one game is
 * live (the section on the home page exists under the same condition).
 */
export function getNavLinks(games: readonly GameDefinition[] = liveGames()): readonly NavLink[] {
  return [
    { label: 'About', href: '/#about' },
    { label: 'Projects', href: '/#projects' },
    { label: 'Experience', href: '/#experience' },
    ...(liveGames(games).length > 0
      ? [{ label: 'Playground', href: '/#playground' } as const]
      : []),
    { label: 'Contact', href: '/#contact' },
  ];
}
