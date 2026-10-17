import { createHash } from 'node:crypto';

// Plain imports with the extension, so that the generator can run this file with Node (see
// scripts/og-cards.ts); the notes are not imported (they need the schema library), their addresses
// are written here and a test compares them with notePath (src/lib/og.test.ts)
import { type GameDefinition, gamesPath } from '../games/registry.ts';

/**
 * The preview cards (Open Graph images): the picture that appears when a link to a page is shared.
 * Every note, every live game and the overviews of the notes, the games and the Uses page have a
 * card of their own with the title and the first line of text, the home page has its own card, and
 * all other pages (the legal pages, the 404 page) use the card of the home page. The pictures are
 * made by `pnpm og` (scripts/generate-og.mjs, a screenshot of a small HTML page) and committed; this
 * module is the pure part: which cards there are, what is on them, and where their files are.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** The card that every page without a card of its own uses (the home page has it too) */
export const defaultCardPath = '/og.png';

export interface OgCard {
  /** "notes/word-radar", "games", "uses": the name of the file without folder and extension */
  id: string;
  /** The small label in the top right corner: the part of the site the page belongs to */
  section: string;
  /** The small line above the title: the tag of a note or of a game */
  eyebrow: string;
  title: string;
  /** One or two sentences under the title; shortened with an ellipsis when it does not fit */
  text: string;
  /** The address of the page, shown at the bottom of the card */
  address: string;
}

/** The text on a card has room for about three lines: longer texts are cut after a whole word */
export const TEXT_LIMIT = 165;

/** Cuts a text after a whole word, with an ellipsis, when it is longer than `limit` */
export function shorten(text: string, limit: number = TEXT_LIMIT): string {
  if (text.length <= limit) {
    return text;
  }
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  // A comma or a full stop at the end of the cut looks odd in front of the ellipsis
  return `${cut.slice(0, space > 0 ? space : cut.length).replace(/[,;:.s]+$/, '')}…`;
}

/** Where the picture of a card is published: /og/notes/word-radar.png */
export function ogPath(id: string): string {
  return `/og/${id}.png`;
}

/** The address of the notes, the same as notesPath in notes.ts (a test compares them) */
export const notesAddress = '/notes/';

/** "leonkrix.dev/notes/word-radar/" for the bottom of a card */
function addressOf(origin: string, path: string): string {
  return `${new URL(origin).hostname}${path}`;
}

export function noteCard(
  origin: string,
  slug: string,
  note: { title: string; summary: string; tag: string },
): OgCard {
  return {
    id: `notes/${slug}`,
    section: 'Behind the scenes',
    eyebrow: note.tag,
    title: note.title,
    text: shorten(note.summary),
    address: addressOf(origin, `${notesAddress}${slug}/`),
  };
}

export function gameCard(origin: string, game: GameDefinition): OgCard {
  return {
    id: `games/${game.slug}`,
    section: 'Playground',
    eyebrow: game.tag,
    title: game.name,
    text: shorten(game.description),
    address: addressOf(origin, `${gamesPath}${game.slug}/`),
  };
}

/** The cards of the overviews and of the Uses page */
export function overviewCards(origin: string): OgCard[] {
  return [
    {
      id: 'notes',
      section: 'Behind the scenes',
      eyebrow: 'Notes',
      title: 'Behind the scenes',
      text: 'How things on this site are made: the problems behind the games and the site itself, and how they are solved.',
      address: addressOf(origin, notesAddress),
    },
    {
      id: 'games',
      section: 'Playground',
      eyebrow: 'Games',
      title: 'Playground',
      text: 'Small games I built myself, running in your browser: tech words, logic, networks and machine learning.',
      address: addressOf(origin, gamesPath),
    },
    {
      id: 'uses',
      section: 'Uses',
      eyebrow: 'Setup',
      title: 'What I work with',
      text: 'The hardware, software and tools I use every day: computers, operating systems, terminal, editors, browsers and AI tools.',
      address: addressOf(origin, '/uses/'),
    },
  ];
}

/**
 * A fingerprint of everything that is on a card and of the template that draws it. It is written
 * next to the pictures when they are made; when a title, a text or the template changes and the
 * pictures were not made again, the fingerprint no longer fits and a test fails.
 */
export function cardFingerprint(card: OgCard | Record<string, string>, template: string): string {
  const text = JSON.stringify([
    template,
    Object.entries(card).sort(([a], [b]) => a.localeCompare(b)),
  ]);
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
