import { expect } from 'vitest';

import { createRandom } from '../../shared/random';
import { skinWords } from '../data/words';
import { Board } from './board';
import { describeClue } from './describe';
import { enumerateClues } from './generator';
import { kindsOf, type Skin } from './skin';
import { type Level } from './types';

/**
 * Checks the sentence of every clue that is true for the solution of a level (not only the clues
 * the level has): a sentence is clean, never names the victim, names only objects that are on the
 * map, and speaks of devices in Outage and of people in Case file. Returns the kinds of clue it
 * saw, so that a test can ask for every kind of clue.
 */
export function checkClueTexts(
  skin: Skin,
  { layout, people, solution }: Pick<Level, 'layout' | 'people' | 'solution'>,
  seed: string,
): Set<string> {
  const seen = new Set<string>();
  const kinds = kindsOf(skin);
  const board = new Board(layout, kinds);
  const clues = enumerateClues(
    { board, people, victim: people.length - 1 },
    layout,
    kinds,
    [...solution],
    3,
    createRandom(seed),
  );
  for (const clue of clues) {
    seen.add(clue.type);
    const text = describeClue(clue, {
      skin,
      words: skinWords[skin.id],
      people,
      layout,
      kinds,
    });
    expect(text, JSON.stringify(clue)).toMatch(/^[A-Za-z][^?]*\.$/);
    expect(text, JSON.stringify(clue)).not.toMatch(/undefined|NaN|\[object|\s{2}|\?/);
    // The victim is never named
    expect(text, JSON.stringify(clue)).not.toContain(people.at(-1)?.name ?? '');
    // A clue names only objects that are on the map
    if (clue.type === 'onFurniture') {
      const present = new Set(layout.objects.map((object) => object.kind));
      for (const [kind, info] of Object.entries(kinds)) {
        const name = (skinWords[skin.id].kinds[kind]?.one ?? '').replace(/^(an?|the) /, '');
        expect(text.includes(name), `${kind} in "${text}"`).toBe(
          info.occupiable && present.has(kind),
        );
      }
    }
    // The people of Outage are devices, and the people of Case file are people
    if (skin.id === 'outage') {
      expect(text, JSON.stringify(clue)).not.toMatch(/\b(person|people|nobody)\b/i);
    } else {
      expect(text, JSON.stringify(clue)).not.toMatch(/\bdevices?\b/i);
    }
  }
  return seen;
}
