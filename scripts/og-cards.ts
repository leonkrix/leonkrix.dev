/**
 * Which preview cards there are and what is on them, read from the real content of the site: the
 * front matter of the notes, the registry of the games and the site configuration. Node only (it
 * reads files); used by the generator (scripts/generate-og.mjs) and by the test that notices a
 * picture that is out of date (tests/build-output/og.test.ts).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { liveGames } from '../src/games/registry.ts';
import {
  cardFingerprint,
  defaultCardPath,
  gameCard,
  noteCard,
  type OgCard,
  overviewCards,
} from '../src/lib/og.ts';
import { siteConfig } from '../src/lib/site.ts';

const root = resolve(import.meta.dirname, '..');

/** The fields of a note's front matter that are written as `key: 'value'` (one line each) */
export function parseFrontMatter(text: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
  const fields: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const match = /^(\w+):\s*(.*)$/.exec(line);
    if (match?.[1] === undefined) {
      continue;
    }
    let value = (match[2] ?? '').trim();
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replaceAll("''", "'");
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    fields[match[1]] = value;
  }
  return fields;
}

/** Every card that has its own picture, in a fixed order (not the card of the home page) */
export function loadCards(): OgCard[] {
  const folder = join(root, 'src', 'content', 'notes');
  const notes = readdirSync(folder)
    .filter((name) => name.endsWith('.mdx'))
    .sort()
    .map((name) => {
      const fields = parseFrontMatter(readFileSync(join(folder, name), 'utf8'));
      const slug = name.replace(/\.mdx$/, '');
      return noteCard(siteConfig.url, slug, {
        title: fields.title ?? '',
        summary: fields.summary ?? '',
        tag: fields.tag ?? '',
      });
    });
  const games = liveGames().map((game) => gameCard(siteConfig.url, game));
  const overviews = overviewCards(siteConfig.url).filter(
    (card) => card.id !== 'games' || games.length > 0,
  );
  return [...overviews, ...notes, ...games];
}

/** The text of the template: part of every fingerprint, so a changed template means new pictures */
export function templateText(): string {
  return readFileSync(join(root, 'scripts', 'og-template.ts'), 'utf8');
}

/** The card of the home page: its fingerprint is made from the name, the role and the address */
export const homeCard = {
  id: 'home',
  name: siteConfig.name,
  role: siteConfig.role,
  address: new URL(siteConfig.url).hostname,
};

/** id -> fingerprint, for every picture there should be (the home card is stored as "home") */
export function expectedFingerprints(): Record<string, string> {
  const template = createHash('sha256').update(templateText()).digest('hex');
  const result: Record<string, string> = { home: cardFingerprint(homeCard, template) };
  for (const card of loadCards()) {
    result[card.id] = cardFingerprint(card, template);
  }
  return result;
}

/** The public file of a picture ("home" is the default card /og.png) */
export function fileOf(id: string): string {
  return id === 'home' ? defaultCardPath : `/og/${id}.png`;
}
