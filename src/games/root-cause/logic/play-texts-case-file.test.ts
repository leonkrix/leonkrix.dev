import { describe, expect, it } from 'vitest';

import { skins } from '../data/skins';
import { checkClueTexts } from './clue-text-checks';
import { generateLevel } from './generator';

// The sentences of the clues on freshly generated levels of one skin (the check on the levels of the
// pool, and the check that every kind of clue is seen, is in play.test.ts). Generating hard levels
// takes a while, so each skin has its own file and the two run side by side.
describe('the texts of the clues on generated levels, in Case file', () => {
  it('are clean on six generated levels of seven people', () => {
    const skin = skins['case-file'];
    let checked = 0;
    for (let seed = 0; seed < 6; seed += 1) {
      const generated = generateLevel(skin, 7, 'hard', `text-${skin.id}-${String(seed)}`);
      if (generated === undefined) {
        continue;
      }
      checked += 1;
      checkClueTexts(skin, generated.level, `text-${skin.id}-${String(seed)}`);
    }
    expect(checked).toBeGreaterThan(0);
  }, 120_000);
});
