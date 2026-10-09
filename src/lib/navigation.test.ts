import { describe, expect, it } from 'vitest';

import { type GameDefinition } from '../games/registry';
import { getNavLinks } from './navigation';

function game(status: GameDefinition['status']): GameDefinition {
  return {
    slug: 'test-game',
    name: 'Test game',
    tag: 'Logic',
    description: 'A test game.',
    icon: 'lucide:puzzle',
    status,
  };
}

describe('getNavLinks', () => {
  it('has no Playground entry while no game is live', () => {
    expect(getNavLinks([game('hidden')]).map((link) => link.label)).toEqual([
      'About',
      'Projects',
      'Experience',
      'Contact',
    ]);
  });

  it('puts the Playground entry between Experience and Contact once a game is live', () => {
    const links = getNavLinks([game('live')]);
    expect(links.map((link) => link.label)).toEqual([
      'About',
      'Projects',
      'Experience',
      'Playground',
      'Contact',
    ]);
    expect(links.find((link) => link.label === 'Playground')?.href).toBe('/#playground');
  });

  it('points every link to a section of the home page', () => {
    for (const link of getNavLinks([game('live')])) {
      expect(link.href).toMatch(/^\/#[a-z]+$/);
    }
  });
});
