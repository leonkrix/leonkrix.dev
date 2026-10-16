import { describe, expect, it } from 'vitest';

import {
  buildItems,
  decodeEmail,
  groupResults,
  paletteGroups,
  randomGame,
  search,
} from './palette';
import { fixture } from './palette-fixture';

const items = buildItems(fixture);
const labels = (query: string): string[] => search(items, query).map((item) => item.label);

describe('buildItems', () => {
  it('has an entry for every place, game, note, project, link and legal page', () => {
    const count = (group: string): number => items.filter((item) => item.group === group).length;
    expect(count('Go to')).toBe(fixture.places.length);
    expect(count('Games')).toBe(fixture.games.length);
    expect(count('Notes')).toBe(fixture.notes.length);
    expect(count('Projects')).toBe(fixture.projects.length);
    expect(count('Links')).toBe(fixture.links.length);
    expect(count('Legal')).toBe(fixture.legal.length);
  });

  it('has unique ids and keeps the order of the groups', () => {
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    const order = items.map((item) => paletteGroups.indexOf(item.group));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('offers a random game only while there is a game', () => {
    expect(items.some((item) => item.action.kind === 'random-game')).toBe(true);
    const none = buildItems({ ...fixture, games: [] });
    expect(none.some((item) => item.action.kind === 'random-game')).toBe(false);
  });

  it('opens external links in a new tab and keeps the rest on the site', () => {
    for (const item of items) {
      if (item.action.kind === 'external') {
        expect(item.group).toBe('Links');
        expect(item.action.href).toMatch(/^https:\/\//);
      }
      if (item.action.kind === 'go') {
        expect(item.action.href).toMatch(/^\//);
      }
    }
  });
});

describe('search', () => {
  it('gives everything for an empty query', () => {
    expect(search(items, '')).toHaveLength(items.length);
    expect(search(items, '   ')).toHaveLength(items.length);
  });

  it('puts a title that starts with the word before one that only contains it', () => {
    const found = labels('word');
    expect(found.slice(0, 2)).toEqual(['Word Radar', 'Word Radar']);
    expect(found).toContain('Tech Words');
    expect(found.indexOf('Tech Words')).toBeGreaterThan(1);
  });

  it('finds an entry by a word of its summary, its tag or its keywords', () => {
    expect(labels('layout')).toContain('A page that never moves');
    expect(labels('impressum')).toEqual(['Legal notice']);
    expect(labels('graph')).toContain('Master thesis');
  });

  it('needs every word of the query', () => {
    expect(labels('word radar')).toEqual(['Word Radar', 'Word Radar']);
    expect(labels('radar zzz')).toEqual([]);
  });

  it('ignores case and finds nothing for nonsense', () => {
    expect(labels('DEFUZE')).toEqual(['Defuze']);
    expect(labels('qwertz')).toEqual([]);
  });
});

describe('groupResults', () => {
  it('collects the results by group, in the order of the best match', () => {
    const groups = groupResults(search(items, 'word'));
    expect(groups.map((group) => group.group)).toEqual(['Games', 'Notes']);
    expect(groups.flatMap((group) => group.items)).toHaveLength(search(items, 'word').length);
  });
});

describe('randomGame', () => {
  it('picks a live game by the random number, and none without a game', () => {
    expect(randomGame(fixture, () => 0)).toBe('/games/tech-words/');
    expect(randomGame(fixture, () => 0.99)).toBe('/games/word-radar/');
    expect(randomGame({ ...fixture, games: [] })).toBeUndefined();
  });
});

describe('decodeEmail', () => {
  it('reads the address back from the data', () => {
    expect(decodeEmail(fixture.email)).toBe('hello@example.test');
  });
});
