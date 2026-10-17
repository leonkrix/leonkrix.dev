import { describe, expect, it } from 'vitest';

import { games, liveGames } from '../games/registry';
import { notePath, notesPath } from './notes';
import {
  cardFingerprint,
  gameCard,
  noteCard,
  notesAddress,
  ogPath,
  overviewCards,
  shorten,
  TEXT_LIMIT,
} from './og';

const ORIGIN = 'https://example.test';
const note = { title: 'A title', summary: 'A short summary of the note.', tag: 'Site · Layout' };

describe('shorten', () => {
  it('leaves a text that fits alone', () => {
    expect(shorten('A short text.')).toBe('A short text.');
    expect(shorten('x'.repeat(TEXT_LIMIT))).toBe('x'.repeat(TEXT_LIMIT));
  });

  it('cuts a longer text after a whole word, with an ellipsis, and never beyond the limit', () => {
    const long = 'word '.repeat(80).trim();
    const short = shorten(long);
    expect(short.length).toBeLessThanOrEqual(TEXT_LIMIT);
    expect(short.endsWith('…')).toBe(true);
    // Every word is whole
    expect(
      short
        .slice(0, -1)
        .split(' ')
        .every((part) => part === 'word'),
    ).toBe(true);
  });

  it('does not leave a comma or a full stop in front of the ellipsis', () => {
    const text = `${'a'.repeat(60)} ${'b'.repeat(60)}, ${'c'.repeat(60)}. ${'d'.repeat(60)}`;
    expect(shorten(text, 130)).not.toMatch(/[,.;:]…$/);
  });

  it('cuts a text without a space at the limit instead of failing', () => {
    expect(shorten('x'.repeat(300)).length).toBeLessThanOrEqual(TEXT_LIMIT);
  });
});

describe('the cards', () => {
  it('has the title, the tag and the address of a note, and its own picture', () => {
    const card = noteCard(ORIGIN, 'word-radar', note);
    expect(card).toMatchObject({
      id: 'notes/word-radar',
      title: 'A title',
      eyebrow: 'Site · Layout',
      section: 'Behind the scenes',
      address: 'example.test/notes/word-radar/',
    });
    expect(ogPath(card.id)).toBe('/og/notes/word-radar.png');
  });

  it('writes the address of a note the way the site does', () => {
    expect(notesAddress).toBe(notesPath);
    expect(noteCard(ORIGIN, 'a-note', note).address).toBe(`example.test${notePath('a-note')}`);
  });

  it('has a card for a game with its name, its tag and its description', () => {
    const game = liveGames()[0];
    expect(game).toBeDefined();
    if (game) {
      const card = gameCard(ORIGIN, game);
      expect(card).toMatchObject({ id: `games/${game.slug}`, title: game.name, eyebrow: game.tag });
      expect(card.address).toBe(`example.test/games/${game.slug}/`);
    }
    expect(games.length).toBeGreaterThan(0);
  });

  it('shortens a long summary, so that it fits the card', () => {
    const card = noteCard(ORIGIN, 'long', { ...note, summary: 'word '.repeat(100) });
    expect(card.text.length).toBeLessThanOrEqual(TEXT_LIMIT);
  });

  it('has the overviews and the Uses page, each with its own name', () => {
    const cards = overviewCards(ORIGIN);
    expect(cards.map((card) => card.id)).toEqual(['notes', 'games', 'uses']);
    expect(new Set(cards.map((card) => card.title)).size).toBe(3);
  });
});

describe('cardFingerprint', () => {
  const card = noteCard(ORIGIN, 'a-note', note);

  it('stays the same for the same card and template', () => {
    expect(cardFingerprint(card, 'template')).toBe(cardFingerprint({ ...card }, 'template'));
  });

  it('changes with every field of the card and with the template', () => {
    const base = cardFingerprint(card, 'template');
    for (const field of ['title', 'text', 'eyebrow', 'section', 'address', 'id'] as const) {
      expect(cardFingerprint({ ...card, [field]: `${card[field]}!` }, 'template'), field).not.toBe(
        base,
      );
    }
    expect(cardFingerprint(card, 'another template')).not.toBe(base);
  });

  it('does not depend on the order of the fields', () => {
    const reversed = Object.fromEntries(Object.entries(card).reverse()) as typeof card;
    expect(cardFingerprint(reversed, 'template')).toBe(cardFingerprint(card, 'template'));
  });
});
