import type { PaletteData } from './palette-data';

/** What happens when an entry is chosen */
export type PaletteAction =
  | { kind: 'go'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'copy-email' }
  | { kind: 'random-game' }
  | { kind: 'terminal' };

export const paletteGroups = [
  'Go to',
  'Games',
  'Notes',
  'Projects',
  'Actions',
  'Links',
  'Legal',
] as const;

export type PaletteGroup = (typeof paletteGroups)[number];

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  /** Small text at the end of the row: a tag, a period, an address */
  hint: string;
  /** More words that find the entry, not shown */
  keywords: string;
  action: PaletteAction;
}

/** Every entry of the palette, in the order of the groups. */
export function buildItems(data: PaletteData): PaletteItem[] {
  const items: PaletteItem[] = [];
  for (const place of data.places) {
    items.push({
      id: `go-${place.href}`,
      group: 'Go to',
      label: place.label,
      hint: place.href.startsWith('/#') ? 'section' : 'page',
      keywords: '',
      action: { kind: 'go', href: place.href },
    });
  }
  for (const game of data.games) {
    items.push({
      id: `game-${game.slug}`,
      group: 'Games',
      label: game.name,
      hint: game.tag,
      keywords: `${game.description} play`,
      action: { kind: 'go', href: game.href },
    });
  }
  for (const note of data.notes) {
    items.push({
      id: `note-${note.slug}`,
      group: 'Notes',
      label: note.title,
      hint: note.tag,
      keywords: `${note.summary} behind the scenes`,
      action: { kind: 'go', href: note.href },
    });
  }
  for (const project of data.projects) {
    items.push({
      id: `project-${project.id}`,
      group: 'Projects',
      label: project.title,
      hint: project.period,
      keywords: project.subtitle,
      action: { kind: 'go', href: project.href },
    });
  }
  if (data.games.length > 0) {
    items.push({
      id: 'action-random-game',
      group: 'Actions',
      label: 'Play a random game',
      hint: '',
      keywords: 'surprise me',
      action: { kind: 'random-game' },
    });
  }
  items.push(
    {
      id: 'action-copy-email',
      group: 'Actions',
      label: 'Copy the email address',
      hint: '',
      keywords: 'mail contact hello clipboard',
      action: { kind: 'copy-email' },
    },
    {
      id: 'action-terminal',
      group: 'Actions',
      label: 'Open the terminal',
      hint: '>',
      keywords: 'command line shell console easter egg',
      action: { kind: 'terminal' },
    },
  );
  for (const link of data.links) {
    items.push({
      id: `link-${link.href}`,
      group: 'Links',
      label: link.label,
      hint: 'opens in a new tab',
      keywords: '',
      action: { kind: 'external', href: link.href },
    });
  }
  for (const link of data.legal) {
    items.push({
      id: `legal-${link.href}`,
      group: 'Legal',
      label: link.label,
      hint: 'page',
      keywords: link.label === 'Legal notice' ? 'impressum imprint' : 'datenschutz gdpr',
      action: { kind: 'go', href: link.href },
    });
  }
  return items;
}

function wordStarts(text: string, token: string): boolean {
  return text.split(/[^a-z0-9]+/).some((word) => word.startsWith(token));
}

/** How well one word of the query matches an entry; 0 means it does not match at all. */
function scoreToken(item: PaletteItem, token: string): number {
  const label = item.label.toLowerCase();
  if (label.startsWith(token)) {
    return 100;
  }
  if (wordStarts(label, token)) {
    return 80;
  }
  if (label.includes(token)) {
    return 60;
  }
  const rest = `${item.keywords} ${item.hint} ${item.group}`.toLowerCase();
  if (wordStarts(rest, token)) {
    return 35;
  }
  return rest.includes(token) ? 20 : 0;
}

/**
 * The entries that match every word of the query, best first. Equal scores keep the order of the
 * list. An empty query gives the whole list. No fuzzy matching: the list is short.
 */
export function search(items: readonly PaletteItem[], query: string): PaletteItem[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [...items];
  }
  const scored = items.flatMap((item, index) => {
    const scores = tokens.map((token) => scoreToken(item, token));
    return scores.includes(0)
      ? []
      : [{ item, index, score: scores.reduce((sum, score) => sum + score, 0) }];
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map(({ item }) => item);
}

export interface ResultGroup {
  group: PaletteGroup;
  items: PaletteItem[];
}

/**
 * The results in groups. Without a query the groups keep their fixed order; with a query the group
 * of the best match comes first, and inside a group the best match comes first.
 */
export function groupResults(results: readonly PaletteItem[]): ResultGroup[] {
  const groups: ResultGroup[] = [];
  for (const item of results) {
    let current = groups.find(({ group }) => group === item.group);
    if (!current) {
      current = { group: item.group, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

/** The address of a random live game, or undefined when there is none. */
export function randomGame(
  data: PaletteData,
  random: () => number = Math.random,
): string | undefined {
  const game = data.games[Math.floor(random() * data.games.length)];
  return game?.href;
}

/** Decodes the mail address of the data (UTF-8 safe base64, like the contact buttons). */
export function decodeEmail(encoded: string): string {
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
