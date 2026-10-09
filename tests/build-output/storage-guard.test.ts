import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { distDir } from './helpers';

/**
 * Guards the promise of the privacy policy: the site stores nothing on the visitor's device (no
 * cookies, no local storage, no IndexedDB, no cache storage). This is the early warning; the real
 * guarantee is the Playwright test that checks the browser after visiting every page
 * (tests/e2e/privacy.spec.ts).
 *
 * Two scans: the source code we write, and the JavaScript that is actually published (which also
 * contains libraries). A library that only mentions one of these names without using it goes on
 * the allow-list below, with the reason.
 */

const root = join(distDir, '..');

/** Browser APIs that store data on the device. */
const STORAGE_API =
  /\b(?:localStorage|sessionStorage|indexedDB|openDatabase|cookieStore|document\s*\.\s*cookie|(?:window|self|globalThis)\s*\.\s*caches|caches\s*\.\s*(?:open|match|has|keys|delete)|navigator\s*\.\s*storage|serviceWorker\s*\.\s*register)\b/g;

/** Names of storage APIs that appear in `text`, without duplicates. */
export function findStorageUse(text: string): string[] {
  return [...new Set(text.match(STORAGE_API)?.map((match) => match.replace(/\s+/g, '')))];
}

/**
 * Files in dist/ that may mention a storage API. Empty on purpose: add an entry only after
 * checking that the library does not use it, and say why.
 */
const DIST_ALLOW_LIST: readonly { file: RegExp; names: readonly string[]; reason: string }[] = [];

/** Source files that may mention the names: the legal texts talk about them. */
const SOURCE_ALLOW_LIST = [join('src', 'components', 'legal')];

function filesBelow(directory: string, extensions: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return filesBelow(path, extensions);
    }
    return extensions.test(entry.name) ? [path] : [];
  });
}

describe('findStorageUse', () => {
  it.each([
    ['localStorage.setItem("a", "b")', ['localStorage']],
    ['window.sessionStorage.clear()', ['sessionStorage']],
    ['const request = indexedDB.open("db")', ['indexedDB']],
    ['document.cookie = "a=b"', ['document.cookie']],
    ['document . cookie', ['document.cookie']],
    ['await caches.open("v1")', ['caches.open']],
    ['window.caches', ['window.caches']],
    ['navigator.storage.estimate()', ['navigator.storage']],
    ['navigator.serviceWorker.register("/sw.js")', ['serviceWorker.register']],
    ['cookieStore.set("a", "b")', ['cookieStore']],
  ])('finds %s', (code, expected) => {
    expect(findStorageUse(code)).toEqual(expected);
  });

  it.each([
    'const stored = "nothing"',
    'const caches = new Map()',
    'cookies are not used',
    'document.cookies',
    'element.storage',
    'myLocalStorageHelper',
  ])('ignores %s', (code) => {
    expect(findStorageUse(code)).toEqual([]);
  });
});

describe('storage guard', () => {
  it('has no browser storage in the source code', () => {
    const files = ['src', 'functions']
      .flatMap((folder) => filesBelow(join(root, folder), /\.(?:ts|tsx|js|mjs|astro)$/))
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter(
        (file) => !SOURCE_ALLOW_LIST.some((allowed) => relative(root, file).startsWith(allowed)),
      );
    expect(files.length, 'scanned source files').toBeGreaterThan(20);

    const found = files.flatMap((file) =>
      findStorageUse(readFileSync(file, 'utf8')).map((name) => `${relative(root, file)}: ${name}`),
    );
    expect(found).toEqual([]);
  });

  it('has no browser storage in the published JavaScript and pages', () => {
    const files = filesBelow(distDir, /\.(?:js|mjs|html)$/);
    expect(files.length, 'scanned published files').toBeGreaterThan(2);

    const found = files.flatMap((file) => {
      const path = relative(distDir, file).replace(/\\/g, '/');
      const allowed = DIST_ALLOW_LIST.filter((entry) => entry.file.test(path)).flatMap(
        (entry) => entry.names,
      );
      return findStorageUse(readFileSync(file, 'utf8'))
        .filter((name) => !allowed.includes(name))
        .map((name) => `${path}: ${name}`);
    });
    expect(found).toEqual([]);
  });
});
