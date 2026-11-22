import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hashOf, normalize } from '../src/lib/whymail-policy.ts';
import { build, check, main, type Paths, sync } from './whymail-policy.ts';

const published = normalize(`# Datenschutzerklärung WhyMail

Stand: 1. Januar 2027

## 1. Wer verantwortlich ist

[NAME DES HERAUSGEBERS]
[ANSCHRIFT]
Telefon: [TELEFON]
E-Mail: whymail.app@gmail.com

---

# Privacy policy of WhyMail

Last updated: 1 January 2027

## 1. Who is responsible

[NAME OF THE PUBLISHER]
[ADDRESS]
Phone: [PHONE]
Email: whymail.app@gmail.com
`);

/** The file of the app: notes for the team on top, then the published text */
const upstream = (text: string): string =>
  `# Privacy policy of WhyMail\n\n## Notes for the team (not part of the published text)\n\n- an internal detail\n\n---\n\n${text}`;

let folder: string;
let paths: Paths;
let upstreamFile: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'whymail-policy-'));
  paths = { snapshot: join(folder, 'copy.md'), page: join(folder, 'page.mdx') };
  upstreamFile = join(folder, 'privacy-policy.md');
  writeFileSync(upstreamFile, upstream(published));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('sync', () => {
  it('writes the copy without the notes for the team, and the page', () => {
    const result = sync(upstreamFile, paths);
    expect(result.before).toBe('none');
    expect(result.after).toBe(hashOf(published));
    const copy = readFileSync(paths.snapshot, 'utf8');
    expect(copy).toBe(published);
    expect(copy).not.toContain('internal detail');
    expect(readFileSync(paths.page, 'utf8')).toContain('<PublisherAddress />');
  });

  it('writes nothing when the conversion fails', () => {
    writeFileSync(upstreamFile, upstream(published.replace('[ANSCHRIFT]', '[UNBEKANNT]')));
    expect(() => sync(upstreamFile, paths)).toThrow(/does not know/);
    expect(() => readFileSync(paths.snapshot)).toThrow();
    expect(() => readFileSync(paths.page)).toThrow();
  });
});

describe('check', () => {
  it('says unchanged for the text that was synced, also with other line endings and notes', () => {
    sync(upstreamFile, paths);
    writeFileSync(
      upstreamFile,
      upstream(published).replaceAll('\n', '\r\n').replace('internal detail', 'another detail'),
    );
    const result = check(upstreamFile, paths);
    expect(result.changed).toBe(false);
    expect(result.recorded).toBe(result.upstream);
  });

  it('says changed when the published text changes', () => {
    sync(upstreamFile, paths);
    writeFileSync(upstreamFile, upstream(published.replace('1. Januar 2027', '2. Februar 2027')));
    const result = check(upstreamFile, paths);
    expect(result.changed).toBe(true);
    expect(result.recorded).not.toBe(result.upstream);
  });

  it('fails when the structure is gone, instead of saying unchanged', () => {
    sync(upstreamFile, paths);
    writeFileSync(upstreamFile, '# Something else\n');
    expect(() => check(upstreamFile, paths)).toThrow();
  });
});

describe('build', () => {
  it('makes the page again from the copy', () => {
    sync(upstreamFile, paths);
    const before = readFileSync(paths.page, 'utf8');
    writeFileSync(paths.page, 'changed by hand');
    expect(build(paths)).toBe(hashOf(published));
    expect(readFileSync(paths.page, 'utf8')).toBe(before);
  });
});

describe('main', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_OUTPUT;
  });

  it('needs a file for sync and check, and knows nothing else', () => {
    expect(main(['sync'])).toBe(1);
    expect(main(['check'])).toBe(1);
    expect(main(['publish'])).toBe(1);
    expect(main([])).toBe(1);
  });

  it('fails with 1 when the file does not exist, never with 0', () => {
    expect(main(['check', join(folder, 'missing.md')])).toBe(1);
  });

  it('writes the result of a check to $GITHUB_OUTPUT', () => {
    // The real copy of this repository is compared with a file that is certainly different
    const output = join(folder, 'output.txt');
    process.env.GITHUB_OUTPUT = output;
    expect(main(['check', upstreamFile])).toBe(0);
    const text = readFileSync(output, 'utf8');
    expect(text).toMatch(/^changed=true$/m);
    expect(text).toMatch(/^recorded=[0-9a-f]{64}$/m);
    expect(text).toMatch(/^upstream=[0-9a-f]{64}$/m);
  });
});
