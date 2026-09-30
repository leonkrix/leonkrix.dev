import { describe, expect, it } from 'vitest';

import { type IconSet, resolveIcon } from './icons';

const sets: Record<string, IconSet> = {
  demo: {
    width: 24,
    height: 24,
    icons: {
      arrow: { body: '<path d="M0 0"/>' },
      wide: { body: '<path d="M1 1"/>', width: 32 },
    },
    aliases: {
      next: { parent: 'arrow' },
    },
  },
};

describe('resolveIcon', () => {
  it('uses the size of the icon set by default', () => {
    expect(resolveIcon(sets, 'demo:arrow')).toEqual({
      body: '<path d="M0 0"/>',
      width: 24,
      height: 24,
    });
  });

  it('prefers a size defined on the icon itself', () => {
    expect(resolveIcon(sets, 'demo:wide')).toMatchObject({ width: 32, height: 24 });
  });

  it('resolves aliases to their parent icon', () => {
    expect(resolveIcon(sets, 'demo:next').body).toBe('<path d="M0 0"/>');
  });

  it('throws for an unknown icon or set, so typos fail the build', () => {
    expect(() => resolveIcon(sets, 'demo:missing')).toThrow('Unknown icon');
    expect(() => resolveIcon(sets, 'other:arrow')).toThrow('Unknown icon');
    expect(() => resolveIcon(sets, 'arrow')).toThrow('Unknown icon');
  });
});
