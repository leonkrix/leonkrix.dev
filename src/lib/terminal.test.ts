import { describe, expect, it } from 'vitest';

import { fixture } from './palette-fixture';
import { type CommandResult, commands, complete, runCommand } from './terminal';

const context = { path: '/uses/' };
const run = (input: string): CommandResult => runCommand(input, fixture, context);
const printed = (input: string): string =>
  run(input)
    .lines.map((line) => line.map((cell) => cell.text).join(''))
    .join('\n');

describe('help', () => {
  it('lists every command, and every listed command can be run', () => {
    const help = printed('help');
    for (const { name, args } of commands) {
      expect(help, name).toContain(name);
      if (args) {
        expect(help).toContain(args);
      }
      // A listed command is never answered with "command not found"
      expect(printed(name), name).not.toContain('command not found');
    }
  });
});

describe('the pages', () => {
  it('prints the projects, games and notes with links to them', () => {
    const links = (input: string): string[] =>
      run(input)
        .lines.flat()
        .flatMap((cell) => (cell.href === undefined ? [] : [cell.href]));
    expect(links('projects')).toEqual(['/#project-defuze', '/#project-master-thesis']);
    expect(links('games')).toEqual(['/games/tech-words/', '/games/word-radar/']);
    expect(links('notes')).toEqual(['/notes/word-radar/', '/notes/a-page-that-never-moves/']);
    expect(printed('projects')).toContain('2024 – 2025');
  });

  it('prints the short version of the Uses page for neofetch and uses', () => {
    expect(printed('neofetch')).toContain('Windows 11');
    expect(printed('neofetch')).toContain('JetBrains IDEs');
    expect(printed('uses')).toBe(printed('neofetch'));
  });

  it('says who I am', () => {
    expect(printed('about')).toContain('Leon Krix');
    expect(printed('whoami')).toContain('visitor');
  });

  it('never prints the email address, it copies it', () => {
    expect(printed('email')).not.toContain('@');
    expect(run('email').effect).toEqual({ kind: 'copy-email' });
    expect(printed('contact')).not.toContain('@');
    expect(printed('cat contact.txt')).not.toContain('@');
  });
});

describe('moving around', () => {
  it('opens a project, a note, a game or a section by name or by its start', () => {
    expect(run('open defuze').effect).toEqual({ kind: 'navigate', href: '/#project-defuze' });
    expect(run('open uses').effect).toEqual({ kind: 'navigate', href: '/uses/' });
    expect(run('open tech').effect).toEqual({ kind: 'navigate', href: '/games/tech-words/' });
    expect(run('open Behind the scenes').effect).toEqual({ kind: 'navigate', href: '/notes/' });
  });

  it('says so when a name fits nothing or several places', () => {
    expect(printed('open nothing-here')).toContain('nothing is called');
    expect(run('open nothing-here').effect).toBeUndefined();
    expect(printed('open word')).toContain('more than one');
    expect(printed('open')).toContain('tell me what to open');
  });

  it('plays a named game, a started name or a random one', () => {
    expect(run('play word-radar').effect).toEqual({ kind: 'navigate', href: '/games/word-radar/' });
    expect(run('play Tech Words').effect).toEqual({ kind: 'navigate', href: '/games/tech-words/' });
    expect(run('play tech').effect).toEqual({ kind: 'navigate', href: '/games/tech-words/' });
    expect(run('play').effect?.kind).toBe('navigate');
    expect(printed('play chess')).toContain('no game called');
  });

  it('lists folders and reads files like a shell', () => {
    expect(printed('ls')).toContain('projects/');
    expect(printed('ls')).toContain('about.txt');
    expect(printed('ls projects')).toBe('defuze\nmaster-thesis');
    expect(printed('ls nowhere')).toContain('No such file or directory');
    expect(printed('cat about.txt')).toContain('Leon Krix');
    expect(printed('cat projects')).toContain('Is a directory');
    expect(printed('cat secrets.txt')).toContain('No such file or directory');
    expect(printed('cat')).toContain('missing file');
  });

  it('changes the place with cd, and knows where it is', () => {
    expect(run('cd projects').effect).toEqual({ kind: 'navigate', href: '/#projects' });
    expect(run('cd notes').effect).toEqual({ kind: 'navigate', href: '/notes/' });
    expect(run('cd ~').effect).toEqual({ kind: 'navigate', href: '/' });
    expect(run('cd ..').effect).toEqual({ kind: 'navigate', href: '/' });
    expect(printed('cd /this-page')).toContain('No such file or directory');
    expect(printed('pwd')).toBe('/uses/');
  });
});

describe('the screen', () => {
  it('clears and exits through effects, and does nothing for an empty line', () => {
    expect(run('clear').effect).toEqual({ kind: 'clear' });
    expect(run('exit').effect).toEqual({ kind: 'close' });
    expect(run(':q').effect).toEqual({ kind: 'close' });
    expect(run('   ')).toEqual({ lines: [] });
    expect(run('radar').effect).toEqual({ kind: 'radar' });
  });
});

describe('git', () => {
  it('shows the commits it was built with', () => {
    expect(printed('git log')).toBe('abc1234 feat: add the uses page (#56)\ndef5678 fix: a thing');
    expect(
      runCommand('git log', { ...fixture, commits: [] }, context).lines[0]?.[0]?.text,
    ).toContain('no history');
    expect(printed('git status')).toContain('working tree clean');
    expect(printed('git push')).toContain('only "git log"');
  });
});

describe('the jokes', () => {
  it('grants permission to hire, and only that', () => {
    expect(printed('sudo hire leon')).toContain('Permission granted.');
    expect(printed('sudo hire leon')).toContain('send an email');
    expect(printed('SUDO hire me')).toContain('Permission granted.');
    expect(printed('sudo rm -rf /')).toContain('not in the sudoers file');
  });

  it('refuses to delete, and answers a few more', () => {
    expect(printed('rm -rf /')).toContain('static');
    expect(printed('vim')).toContain(':q');
    expect(printed('echo hello  world')).toBe('hello world');
    expect(printed('ping')).toContain('PONG');
  });

  it('knows a command is missing like a shell does', () => {
    expect(printed('frobnicate now')).toBe(
      'frobnicate: command not found. Type "help" for the list.',
    );
    expect(run('frobnicate').lines[0]?.[0]?.tone).toBe('error');
  });
});

describe('complete', () => {
  it('completes a command, a name and a file with Tab', () => {
    expect(complete('pro', fixture)).toBe('projects ');
    expect(complete('open def', fixture)).toBe('open defuze ');
    expect(complete('cat ab', fixture)).toBe('cat about.txt ');
    expect(complete('play te', fixture)).toBe('play tech-words ');
    expect(complete('git l', fixture)).toBe('git log ');
  });

  it('completes the common start when several fit, and nothing when none fits', () => {
    expect(complete('c', fixture)).toBe('c');
    expect(complete('cl', fixture)).toBe('clear ');
    expect(complete('zzz', fixture)).toBeUndefined();
    expect(complete('', fixture)).toBeUndefined();
    expect(complete('echo x', fixture)).toBeUndefined();
  });
});
