import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { pages } from '../e2e/pages';
import { distDir, readPages } from './helpers';

// Nothing on any page may move (the layout guard of the browser tests). That only protects pages
// that a browser test opens, so these checks make sure that no page and no test is left out.

const e2eDir = join(import.meta.dirname, '..', 'e2e');
/** Files in tests/e2e that are not tests */
const helpers = new Set(['fixtures.ts', 'layout-guard.ts', 'pages.ts']);

/** The address of a built page: dist/games/index.html is /games/ */
function addressOf(file: string): string {
  const path = relative(distDir, file).split(sep).join('/');
  return path === 'index.html' ? '/' : `/${path.replace(/index\.html$/, '')}`;
}

describe('every page is covered by the browser tests', () => {
  it('lists every page of the build in tests/e2e/pages.ts (the 404 page has its own address)', async () => {
    const built = (await readPages())
      .map(({ file }) => addressOf(file))
      .filter((address) => address !== '/404.html');
    expect([...built].sort()).toEqual([...pages].sort());
  });

  it('uses the shared fixture in every browser test, so the layout guard is on', () => {
    const specs = readdirSync(e2eDir).filter((name) => name.endsWith('.ts') && !helpers.has(name));
    expect(specs.length).toBeGreaterThan(0);
    for (const name of specs) {
      const source = readFileSync(join(e2eDir, name), 'utf8');
      // `test` must come from './fixtures', not from Playwright itself
      expect(source, name).not.toMatch(
        /import\s*(?:type\s*)?\{[^}]*\btest\b[^}]*\}\s*from\s*'@playwright\/test'/,
      );
      expect(source, name).toMatch(/from '\.\/fixtures'/);
    }
  });

  it('switches the layout guard off only with a reason next to it', () => {
    const specs = readdirSync(e2eDir).filter((name) => name.endsWith('.ts') && !helpers.has(name));
    for (const name of specs) {
      const lines = readFileSync(join(e2eDir, name), 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (/layoutGuard:\s*false/.test(line)) {
          const before = lines.slice(Math.max(0, index - 3), index).join('\n');
          expect(before, `${name}:${String(index + 1)} needs a comment that says why`).toMatch(
            /^\s*\/\/ .{20,}/m,
          );
        }
      });
    }
  });
});
