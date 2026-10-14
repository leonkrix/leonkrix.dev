import { describe, expect, it } from 'vitest';

import { formatUpdated, notePath, noteSchema, readingMinutes, sortNotes } from './notes';

const valid = {
  title: 'Root Cause',
  summary: 'How a logic puzzle can prove that it has exactly one solution.',
  tag: 'Logic',
  group: 'games',
  order: 1,
  updated: '2026-10-14',
};

describe('noteSchema', () => {
  it('accepts a note', () => {
    expect(noteSchema.safeParse(valid).success).toBe(true);
    expect(
      noteSchema.safeParse({ ...valid, game: 'root-cause', code: 'src/games/root-cause' }).success,
    ).toBe(true);
  });

  it('refuses a short summary, a bad game slug, a bad folder and a bad date', () => {
    expect(noteSchema.safeParse({ ...valid, summary: 'Too short.' }).success).toBe(false);
    expect(noteSchema.safeParse({ ...valid, game: 'Root Cause' }).success).toBe(false);
    expect(noteSchema.safeParse({ ...valid, code: '../secret' }).success).toBe(false);
    expect(noteSchema.safeParse({ ...valid, code: 'a b' }).success).toBe(false);
    expect(noteSchema.safeParse({ ...valid, updated: '14.10.2026' }).success).toBe(false);
  });
});

describe('sortNotes', () => {
  it('puts the notes of the site before the notes of the games, each by its place', () => {
    const notes = [
      { id: 'b-game', data: { group: 'games' as const, order: 2 } },
      { id: 'a-site', data: { group: 'site' as const, order: 2 } },
      { id: 'a-game', data: { group: 'games' as const, order: 1 } },
      { id: 'b-site', data: { group: 'site' as const, order: 1 } },
    ];
    expect(sortNotes(notes).map((note) => note.id)).toEqual([
      'b-site',
      'a-site',
      'a-game',
      'b-game',
    ]);
  });

  it('refuses a note without a group or with an unknown one', () => {
    expect(noteSchema.safeParse({ ...valid, group: undefined }).success).toBe(false);
    expect(noteSchema.safeParse({ ...valid, group: 'blog' }).success).toBe(false);
  });
});

describe('helpers', () => {
  it('writes the address of a note', () => {
    expect(notePath('root-cause')).toBe('/notes/root-cause/');
  });

  it('reads at about 200 words a minute, at least one minute', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('word '.repeat(200))).toBe(1);
    expect(readingMinutes('word '.repeat(1000))).toBe(5);
  });

  it('writes the day out', () => {
    expect(formatUpdated('2026-10-14')).toBe('14 October 2026');
    expect(formatUpdated('2027-01-02')).toBe('2 January 2027');
  });
});
