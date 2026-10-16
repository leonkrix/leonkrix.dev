import { randomGame } from './palette';
import type { PaletteData } from './palette-data';

/**
 * The commands of the terminal: one list for the palette (type ">") and for the 404 page. Pure
 * functions: a command gets its text and the data of the site and returns lines to print and, maybe,
 * something to do (go to a page, clear the screen). Nothing here knows the page or the DOM, so every
 * command is tested without a browser.
 */

export type Tone = 'plain' | 'muted' | 'ok' | 'error' | 'accent';

/** A piece of a line; with `href` it is a link */
export interface Cell {
  text: string;
  href?: string;
  tone?: Tone;
}

export type Line = Cell[];

export type Effect =
  | { kind: 'navigate'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'clear' }
  | { kind: 'close' }
  | { kind: 'copy-email' }
  | { kind: 'sweep' };

export interface CommandResult {
  lines: Line[];
  effect?: Effect;
}

export interface Context {
  /** The path of the page the terminal is on, for `pwd` */
  path: string;
}

interface CommandInfo {
  name: string;
  /** Shown after the name in `help` */
  args?: string;
  description: string;
}

/** The commands `help` lists. There are a few more that `help` does not tell. */
export const commands: readonly CommandInfo[] = [
  { name: 'help', description: 'this list' },
  { name: 'about', description: 'who I am and what I am doing' },
  { name: 'projects', description: 'the projects and theses' },
  { name: 'games', description: 'the games of the Playground' },
  { name: 'notes', description: 'the write-ups of how this site is built' },
  { name: 'neofetch', description: 'what I work with (the short version of /uses)' },
  { name: 'open', args: '<name>', description: 'go to a project, note, game or section' },
  { name: 'play', args: '[game]', description: 'play a game, or a random one' },
  { name: 'ls', args: '[folder]', description: 'list the places of this site' },
  { name: 'cat', args: '<file>', description: 'read about.txt, uses.txt or contact.txt' },
  { name: 'cd', args: '<folder>', description: 'go to a place' },
  { name: 'git', args: 'log', description: 'the latest changes of this site' },
  { name: 'email', description: 'copy my email address' },
  { name: 'whoami', description: 'you guessed it' },
  { name: 'radar', description: 'a short sweep over the page' },
  { name: 'clear', description: 'empty the screen' },
  { name: 'exit', description: 'close the terminal' },
];

const text = (value: string, tone?: Tone, href?: string): Cell => ({
  text: value,
  ...(tone ? { tone } : {}),
  ...(href ? { href } : {}),
});
const row = (...cells: Cell[]): Line => cells;
const plain = (value: string, tone?: Tone): Line => [text(value, tone)];
const error = (value: string): CommandResult => ({ lines: [plain(value, 'error')] });
const pad = (value: string, width: number): string => value.padEnd(width, ' ');

/** The sections and pages one can name, with the address */
function destinations(data: PaletteData): { names: string[]; label: string; href: string }[] {
  const places = data.places.map((place) => ({
    names: [place.label.toLowerCase(), place.href.replace(/^\/#?|\/$/g, '')],
    label: place.label,
    href: place.href,
  }));
  return [
    ...places,
    ...data.projects.map((project) => ({
      names: [project.id, project.title.toLowerCase()],
      label: project.title,
      href: project.href,
    })),
    ...data.notes.map((note) => ({
      names: [note.slug, note.title.toLowerCase()],
      label: note.title,
      href: note.href,
    })),
    ...data.games.map((game) => ({
      names: [game.slug, game.name.toLowerCase()],
      label: game.name,
      href: game.href,
    })),
  ];
}

/** Finds one place by name; an exact name wins, otherwise the start of a name must be unambiguous. */
function findDestination(
  data: PaletteData,
  query: string,
): { found: { label: string; href: string } } | { many: string[] } | undefined {
  const wanted = query
    .toLowerCase()
    .replace(/^\.?\//, '')
    .replace(/\/$/, '');
  if (wanted === '') {
    return undefined;
  }
  const all = destinations(data);
  const exact = all.find(({ names }) => names.includes(wanted));
  if (exact) {
    return { found: exact };
  }
  const starts = all.filter(({ names }) => names.some((name) => name.startsWith(wanted)));
  const [first, ...others] = starts;
  if (first && others.length === 0) {
    return { found: first };
  }
  return starts.length > 1 ? { many: starts.map(({ label }) => label) } : undefined;
}

function neofetch(data: PaletteData): CommandResult {
  const width = Math.max(...data.uses.map(({ label }) => label.length)) + 2;
  return {
    lines: [
      plain('leon@leonkrix.dev', 'accent'),
      plain('-----------------', 'muted'),
      ...data.uses.map(({ label, value }) => row(text(pad(label, width), 'accent'), text(value))),
      row(text('more: ', 'muted'), text('/uses/', 'accent', '/uses/')),
    ],
  };
}

function aboutLines(data: PaletteData): CommandResult {
  return {
    lines: [
      row(text(data.about.name, 'accent'), text(`, ${data.about.role}`)),
      ...data.about.lines.map((line) => plain(line, 'muted')),
      row(text('more: ', 'muted'), text('/#about', 'accent', '/#about')),
    ],
  };
}

function contactLines(): CommandResult {
  return {
    lines: [
      plain('Write to me through the contact form, or type "email" to copy the address.'),
      row(text('contact form: ', 'muted'), text('/#contact', 'accent', '/#contact')),
    ],
  };
}

/** The files `cat` can read, and the folders `ls` can list. */
const files = ['about.txt', 'uses.txt', 'contact.txt'] as const;
const folders = ['projects', 'games', 'notes'] as const;

function listFolder(data: PaletteData, folder: string): CommandResult {
  const names =
    folder === 'projects'
      ? data.projects.map((project) => project.id)
      : folder === 'games'
        ? data.games.map((game) => game.slug)
        : data.notes.map((note) => note.slug);
  const links = new Map<string, string>(
    folder === 'projects'
      ? data.projects.map((project) => [project.id, project.href] as const)
      : folder === 'games'
        ? data.games.map((game) => [game.slug, game.href] as const)
        : data.notes.map((note) => [note.slug, note.href] as const),
  );
  return {
    lines: names.map((name) => row(text(name, 'accent', links.get(name)))),
  };
}

function listing(data: PaletteData, args: string[]): CommandResult {
  const target = args.find((arg) => !arg.startsWith('-'))?.replace(/\/$/, '');
  if (target === undefined || target === '~' || target === '.' || target === '/') {
    return {
      lines: [
        row(...folders.flatMap((name) => [text(`${name}/`, 'accent'), text('  ')])),
        row(...files.flatMap((name) => [text(name), text('  ')])),
      ],
    };
  }
  if ((folders as readonly string[]).includes(target)) {
    return listFolder(data, target);
  }
  if ((files as readonly string[]).includes(target)) {
    return { lines: [plain(target)] };
  }
  return error(`ls: cannot access '${target}': No such file or directory`);
}

function readFile(data: PaletteData, args: string[]): CommandResult {
  const target = args[0];
  if (target === undefined) {
    return error('cat: missing file. Try "cat about.txt".');
  }
  if (target === 'about.txt') {
    return aboutLines(data);
  }
  if (target === 'uses.txt') {
    return neofetch(data);
  }
  if (target === 'contact.txt') {
    return contactLines();
  }
  const folder = target.replace(/\/$/, '');
  return (folders as readonly string[]).includes(folder)
    ? error(`cat: ${folder}: Is a directory`)
    : error(`cat: ${target}: No such file or directory`);
}

function changeDirectory(data: PaletteData, args: string[]): CommandResult {
  const target = args[0];
  if (target === undefined || target === '~' || target === '..' || target === '/') {
    return { lines: [], effect: { kind: 'navigate', href: '/' } };
  }
  const place = findDestination(data, target);
  if (place && 'found' in place) {
    return { lines: [], effect: { kind: 'navigate', href: place.found.href } };
  }
  return error(`cd: ${target}: No such file or directory`);
}

function open(data: PaletteData, args: string[]): CommandResult {
  const query = args.join(' ');
  if (query === '') {
    return error('open: tell me what to open, for example "open defuze" or "open uses".');
  }
  const place = findDestination(data, query);
  if (place && 'found' in place) {
    return {
      lines: [plain(`Opening ${place.found.label}...`, 'muted')],
      effect: { kind: 'navigate', href: place.found.href },
    };
  }
  if (place) {
    return error(`open: "${query}" fits more than one place: ${place.many.join(', ')}`);
  }
  return error(`open: nothing is called "${query}". Try "ls" or "projects".`);
}

function play(data: PaletteData, args: string[]): CommandResult {
  const query = args.join(' ').toLowerCase();
  if (data.games.length === 0) {
    return error('play: there is no game yet.');
  }
  if (query === '') {
    const href = randomGame(data);
    return href === undefined
      ? error('play: there is no game yet.')
      : { lines: [plain('Picking a game...', 'muted')], effect: { kind: 'navigate', href } };
  }
  const game = data.games.find(
    (entry) => entry.slug === query || entry.name.toLowerCase() === query,
  );
  const starts = data.games.filter(
    (entry) => entry.slug.startsWith(query) || entry.name.toLowerCase().startsWith(query),
  );
  const chosen = game ?? (starts.length === 1 ? starts[0] : undefined);
  return chosen
    ? {
        lines: [plain(`Starting ${chosen.name}...`, 'muted')],
        effect: { kind: 'navigate', href: chosen.href },
      }
    : error(`play: no game called "${query}". Games: ${data.games.map((g) => g.slug).join(', ')}`);
}

function git(data: PaletteData, args: string[]): CommandResult {
  if (args[0] === 'log') {
    if (data.commits.length === 0) {
      return { lines: [plain('This build has no history to show.', 'muted')] };
    }
    return {
      lines: data.commits.map(({ hash, subject }) =>
        row(text(`${hash} `, 'accent'), text(subject)),
      ),
    };
  }
  if (args[0] === 'status') {
    return {
      lines: [plain('On branch main'), plain('nothing to commit, working tree clean', 'muted')],
    };
  }
  return error('git: only "git log" and "git status" work in here.');
}

function sudo(args: string[]): CommandResult {
  const rest = args.join(' ').toLowerCase();
  if (/^hire (leon|me)$/.test(rest)) {
    return {
      lines: [
        plain('Permission granted.', 'ok'),
        row(text('Please send an email: ', 'muted'), text('/#contact', 'accent', '/#contact')),
      ],
    };
  }
  return {
    lines: [plain('visitor is not in the sudoers file. This incident will be reported.', 'error')],
  };
}

function remove(): CommandResult {
  return {
    lines: [plain('rm: this site is static, there is nothing to delete here. Nice try.', 'error')],
  };
}

function helpLines(): CommandResult {
  const width = Math.max(
    ...commands.map(({ name, args }) => (name + (args ? ` ${args}` : '')).length),
  );
  return {
    lines: [
      ...commands.map(({ name, args, description }) =>
        row(
          text(pad(name + (args ? ` ${args}` : ''), width + 2), 'accent'),
          text(description, 'muted'),
        ),
      ),
      plain('There may be a few more. Try a command you know from a real shell.', 'muted'),
    ],
  };
}

function projectsLines(data: PaletteData): CommandResult {
  const width = Math.max(...data.projects.map(({ title }) => title.length)) + 2;
  return {
    lines: data.projects.flatMap((project) => [
      row(
        text(pad(project.title, width), 'accent', project.href),
        text(`${project.period}  `, 'muted'),
        text(project.subtitle),
      ),
    ]),
  };
}

function gamesLines(data: PaletteData): CommandResult {
  if (data.games.length === 0) {
    return { lines: [plain('No games yet.', 'muted')] };
  }
  const width = Math.max(...data.games.map(({ name }) => name.length)) + 2;
  return {
    lines: [
      ...data.games.map((game) =>
        row(
          text(pad(game.name, width), 'accent', game.href),
          text(pad(game.tag, 8), 'muted'),
          text(game.description),
        ),
      ),
      plain('Type "play <game>" to start one.', 'muted'),
    ],
  };
}

function notesLines(data: PaletteData): CommandResult {
  return {
    lines: data.notes.map((note) =>
      row(text(note.title, 'accent', note.href), text(`  ${note.tag}`, 'muted')),
    ),
  };
}

/** Runs one line of input. Never throws; an unknown command is a message like in a real shell. */
export function runCommand(input: string, data: PaletteData, context: Context): CommandResult {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const [first, ...args] = words;
  if (first === undefined) {
    return { lines: [] };
  }
  const name = first.toLowerCase();
  switch (name) {
    case 'help':
    case '?':
      return helpLines();
    case 'about':
      return aboutLines(data);
    case 'projects':
      return projectsLines(data);
    case 'games':
      return gamesLines(data);
    case 'notes':
      return notesLines(data);
    case 'neofetch':
    case 'uses':
      return neofetch(data);
    case 'contact':
      return contactLines();
    case 'open':
      return open(data, args);
    case 'play':
      return play(data, args);
    case 'ls':
    case 'dir':
      return listing(data, args);
    case 'cat':
      return readFile(data, args);
    case 'cd':
      return changeDirectory(data, args);
    case 'pwd':
      return { lines: [plain(context.path)] };
    case 'git':
      return git(data, args);
    case 'email':
    case 'mail':
      return {
        lines: [plain('Copied my email address to the clipboard.', 'ok')],
        effect: { kind: 'copy-email' },
      };
    case 'whoami':
      return {
        lines: [plain('visitor'), plain(`(I am ${data.about.name}, but you can stay.)`, 'muted')],
      };
    case 'radar':
      return { lines: [plain('Sweeping...', 'muted')], effect: { kind: 'sweep' } };
    case 'clear':
    case 'cls':
      return { lines: [], effect: { kind: 'clear' } };
    case 'exit':
    case 'quit':
    case 'q':
    case ':q':
      return { lines: [], effect: { kind: 'close' } };
    case 'sudo':
      return sudo(args);
    case 'rm':
      return remove();
    case 'vim':
    case 'vi':
    case 'nano':
    case 'emacs':
      return {
        lines: [
          plain('You are reading a website, not a file. Type ":q" to leave anyway.', 'muted'),
        ],
      };
    case 'echo':
      return { lines: [plain(args.join(' '))] };
    case 'ping':
      return {
        lines: [plain('PONG. A static file, answered by the nearest Cloudflare server.', 'ok')],
      };
    default:
      return error(`${first}: command not found. Type "help" for the list.`);
  }
}

/** The commands one can type, for completion with Tab: the listed ones and a few that are not */
const typeable = [...commands.map(({ name }) => name), 'pwd', 'contact', 'uses'];

/**
 * Completes the word at the end of the line with Tab. Returns the new line, or undefined when
 * nothing fits (more than one fit completes the common start).
 */
export function complete(line: string, data: PaletteData): string | undefined {
  const parts = line.split(/\s+/);
  const last = parts.at(-1) ?? '';
  const first = parts[0]?.toLowerCase() ?? '';
  let options: string[];
  if (parts.length === 1) {
    options = typeable;
  } else if (first === 'open') {
    options = destinations(data).flatMap(({ names }) => names.slice(0, 1));
  } else if (first === 'play') {
    options = data.games.map((game) => game.slug);
  } else if (first === 'cat') {
    options = [...files];
  } else if (first === 'cd' || first === 'ls') {
    options = [...folders, ...destinations(data).flatMap(({ names }) => names.slice(0, 1))];
  } else if (first === 'git') {
    options = ['log', 'status'];
  } else {
    return undefined;
  }
  const fits = [...new Set(options)].filter((option) => option.startsWith(last.toLowerCase()));
  if (fits.length === 0 || last === '') {
    return undefined;
  }
  let common = fits[0] ?? '';
  for (const option of fits) {
    while (!option.startsWith(common)) {
      common = common.slice(0, -1);
    }
  }
  return [...parts.slice(0, -1), common].join(' ') + (fits.length === 1 ? ' ' : '');
}
