import { existsSync, readFileSync } from 'node:fs';
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

  it('keeps local secret files out of git', () => {
    const ignored = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');
    for (const entry of ['.env', '.dev.vars']) {
      expect(ignored, entry).toContain(entry);
    }
  });

  it('keeps Claude Code from reading the local secret files', () => {
    const settings = readFileSync(join(root, '.claude', 'settings.json'), 'utf8');
    expect(settings).toContain('Read(./.dev.vars)');
    expect(settings).toContain('Read(./.env)');
  });
});
