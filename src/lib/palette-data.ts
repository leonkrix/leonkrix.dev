import { type GameDefinition, gamePath, gamesPath } from '../games/registry';
import type { NavLink } from './navigation';
import { encodeBase64 } from './obfuscate';

/**
 * What the command palette and the terminal know about the site. It is made at build time from the
 * real data (the sections, the games, the notes, the projects, the Uses page, the last commits) and
 * published as `/palette.json`; the browser fetches it the first time the palette is opened. Plain
 * data, so the page code, the tests and the endpoint share the type.
 */

export interface PaletteLink {
  label: string;
  href: string;
}

export interface PaletteGame {
  slug: string;
  name: string;
  tag: string;
  description: string;
  href: string;
}

export interface PaletteNote {
  slug: string;
  title: string;
  summary: string;
  tag: string;
  href: string;
}

export interface PaletteProject {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  href: string;
}

export interface PaletteCommit {
  hash: string;
  subject: string;
}

export interface PaletteData {
  /** The places on the site: the sections of the home page and the other pages */
  places: PaletteLink[];
  games: PaletteGame[];
  notes: PaletteNote[];
  projects: PaletteProject[];
  /** External profiles and the source code */
  links: PaletteLink[];
  legal: PaletteLink[];
  /** The short version of the Uses page, like the lines of neofetch */
  uses: { label: string; value: string }[];
  /** The last commits of the repository, newest first (may be empty in a build without history) */
  commits: PaletteCommit[];
  /** Name, role and a few sentences about me */
  about: { name: string; role: string; lines: string[] };
  /** The mail address, base64 like on the page, so that it is not readable text in a file */
  email: string;
}

export interface PaletteInput {
  navLinks: readonly NavLink[];
  games: readonly GameDefinition[];
  notes: readonly { id: string; data: Omit<PaletteNote, 'slug' | 'href'> }[];
  projects: readonly {
    id: string;
    data: {
      title: string;
      subtitle?: string | undefined;
      start: number;
      end?: number | undefined;
    };
  }[];
  externalLinks: readonly PaletteLink[];
  uses: readonly { label: string; value: string }[];
  commits: readonly PaletteCommit[];
  site: { name: string; role: string; description: string; email: string };
  nowItems: readonly string[];
  formatPeriod: (project: { start: number; end?: number | undefined }) => string;
  notePath: (slug: string) => string;
}

/** A line of a commit subject can be long; the terminal shows one line. */
const SUBJECT_LIMIT = 72;

export function buildPaletteData(input: PaletteInput): PaletteData {
  const live = input.games;
  return {
    places: [
      ...input.navLinks.map(({ label, href }) => ({ label, href })),
      ...(live.length > 0 ? [{ label: 'All games', href: gamesPath }] : []),
      { label: 'Behind the scenes', href: '/notes/' },
      { label: 'Uses', href: '/uses/' },
    ],
    games: live.map((game) => ({
      slug: game.slug,
      name: game.name,
      tag: game.tag,
      description: game.description,
      href: gamePath(game.slug),
    })),
    notes: input.notes.map(({ id, data }) => ({
      slug: id,
      title: data.title,
      summary: data.summary,
      tag: data.tag,
      href: input.notePath(id),
    })),
    projects: input.projects.map(({ id, data }) => ({
      id,
      title: data.title,
      subtitle: data.subtitle ?? '',
      period: input.formatPeriod(data),
      href: `/#project-${id}`,
    })),
    links: [...input.externalLinks],
    legal: [
      { label: 'Legal notice', href: '/legal-notice' },
      { label: 'Privacy policy', href: '/privacy-policy' },
    ],
    uses: input.uses.map(({ label, value }) => ({ label, value })),
    commits: input.commits.map(({ hash, subject }) => ({
      hash,
      subject: subject.length > SUBJECT_LIMIT ? `${subject.slice(0, SUBJECT_LIMIT - 1)}…` : subject,
    })),
    about: {
      name: input.site.name,
      role: input.site.role,
      lines: [input.site.description, ...input.nowItems],
    },
    email: encodeBase64(input.site.email),
  };
}

/** The last commits as "hash subject" lines of `git log`, empty when git or its history is missing. */
export function parseCommits(output: string): PaletteCommit[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .flatMap((line) => {
      const space = line.indexOf(' ');
      return space > 0 ? [{ hash: line.slice(0, space), subject: line.slice(space + 1) }] : [];
    });
}
