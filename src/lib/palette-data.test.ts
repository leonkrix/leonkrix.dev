import { describe, expect, it } from 'vitest';

import { games, liveGames } from '../games/registry';
import { getNavLinks } from './navigation';
import { notePath } from './notes';
import { decodeEmail } from './palette';
import { buildPaletteData, parseCommits } from './palette-data';
import { formatPeriod } from './projects';

const input = (overrides: Partial<Parameters<typeof buildPaletteData>[0]> = {}) => ({
  navLinks: getNavLinks(),
  games: liveGames(games),
  notes: [
    {
      id: 'word-radar',
      data: { title: 'Word Radar', summary: 'How it works', tag: 'ML' },
    },
  ],
  projects: [{ id: 'defuze', data: { title: 'Defuze', subtitle: 'MERN', start: 2023, end: 2024 } }],
  externalLinks: [{ label: 'GitHub', href: 'https://github.com/leonkrix' }],
  uses: [{ label: 'OS', value: 'Windows 11' }],
  commits: [{ hash: 'abc1234', subject: 'feat: a thing' }],
  site: {
    name: 'Leon Krix',
    role: 'Software Engineer',
    description: 'A software engineer.',
    email: 'hello@example.test',
  },
  nowItems: ['Building things'],
  formatPeriod,
  notePath,
  ...overrides,
});

describe('buildPaletteData', () => {
  it('names the places of the site, with the Uses page and the notes', () => {
    const { places } = buildPaletteData(input());
    const hrefs = places.map((place) => place.href);
    expect(hrefs).toContain('/#about');
    expect(hrefs).toContain('/uses/');
    expect(hrefs).toContain('/notes/');
    expect(hrefs).toContain('/games/');
  });

  it('leaves out the overview of the games while there is no game', () => {
    const { places, games: none } = buildPaletteData(input({ games: [] }));
    expect(none).toEqual([]);
    expect(places.map((place) => place.href)).not.toContain('/games/');
  });

  it('links the projects to their cards and the notes to their pages', () => {
    const data = buildPaletteData(input());
    expect(data.projects).toEqual([
      {
        id: 'defuze',
        title: 'Defuze',
        subtitle: 'MERN',
        period: '2023 – 2024',
        href: '/#project-defuze',
      },
    ]);
    expect(data.notes[0]?.href).toBe('/notes/word-radar/');
  });

  it('keeps the address as base64 and shortens a long commit subject', () => {
    const long = 'x'.repeat(200);
    const data = buildPaletteData(input({ commits: [{ hash: 'a', subject: long }] }));
    expect(JSON.stringify(data)).not.toContain('example.test');
    expect(decodeEmail(data.email)).toBe('hello@example.test');
    expect(data.commits[0]?.subject).toHaveLength(72);
    expect(data.commits[0]?.subject.endsWith('…')).toBe(true);
  });

  it('puts the description and the current activities into the about lines', () => {
    expect(buildPaletteData(input()).about.lines).toEqual([
      'A software engineer.',
      'Building things',
    ]);
  });
});

describe('parseCommits', () => {
  it('reads "hash subject" lines and skips empty ones', () => {
    expect(parseCommits('abc1234 feat: one (#1)\n\ndef5678 fix: two\n')).toEqual([
      { hash: 'abc1234', subject: 'feat: one (#1)' },
      { hash: 'def5678', subject: 'fix: two' },
    ]);
    expect(parseCommits('')).toEqual([]);
    expect(parseCommits('nospace')).toEqual([]);
  });
});
