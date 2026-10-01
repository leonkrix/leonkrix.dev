import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { distDir } from './helpers';

const root = join(distDir, '..');

describe('repository guards', () => {
  it.each(['wrangler.json', 'wrangler.jsonc', 'wrangler.toml'])(
    'has no %s: with a Wrangler configuration file Cloudflare Pages ignores the dashboard variables at build time, including the Impressum address, and the production build fails',
    (name) => {
      expect(existsSync(join(root, name))).toBe(false);
    },
  );

  it('has no hidden bidirectional or control characters in source files (Trojan Source)', () => {
    // Such characters make code look different from what it does. Write them as escapes
    // (the code U+202E written as a backslash u escape in a string) when a test needs them.
    const hidden = (codePoint: number): boolean =>
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069) ||
      codePoint === 0xfeff ||
      codePoint === 0x2028 ||
      codePoint === 0x2029 ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      (codePoint < 0x20 && ![0x09, 0x0a, 0x0d].includes(codePoint));

    const extensions = /\.(ts|tsx|astro|mjs|cjs|js|json|jsonc|yml|yaml|css|md|html|txt|xml)$/;
    const found: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(path);
        } else if (extensions.test(entry.name)) {
          for (const character of readFileSync(path, 'utf8')) {
            if (hidden(character.codePointAt(0) ?? 0)) {
              found.push(`${path} contains U+${(character.codePointAt(0) ?? 0).toString(16)}`);
              break;
            }
          }
        }
      }
    };
    for (const folder of ['src', 'functions', 'tests', 'scripts', 'public', '.github']) {
      visit(join(root, folder));
    }
    expect(found).toEqual([]);
  });

  it('keeps local secret files out of git', () => {
    const ignored = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');
    for (const entry of ['.env', '.dev.vars']) {
      expect(ignored, entry).toContain(entry);
    }
  });
});
