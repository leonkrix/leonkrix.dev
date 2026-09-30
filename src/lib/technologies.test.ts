import lucide from '@iconify-json/lucide/icons.json';
import simpleIcons from '@iconify-json/simple-icons/icons.json';
import { describe, expect, it } from 'vitest';

import { type IconSet, resolveIcon } from './icons';
import { technologies, technologyGroups } from './technologies';

const sets = { lucide, 'simple-icons': simpleIcons } as unknown as Record<string, IconSet>;

describe('technologies', () => {
  it('only uses icons that exist in the local icon sets', () => {
    for (const [id, technology] of Object.entries(technologies)) {
      expect(() => resolveIcon(sets, technology.icon), id).not.toThrow();
    }
  });

  it('lists every technology in exactly one group', () => {
    const grouped = technologyGroups.flatMap((group) => group.items);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(Object.keys(technologies).sort());
  });
});
