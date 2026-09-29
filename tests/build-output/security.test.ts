import { beforeAll, describe, expect, it } from 'vitest';

import { type Page, readDistFile, readPages, readStylesheets } from './helpers';

let pages: Page[] = [];
let stylesheets: Page[] = [];
let headersFile = '';

beforeAll(async () => {
  pages = await readPages();
  stylesheets = await readStylesheets();
  headersFile = await readDistFile('_headers');
});

function cspOf(html: string): Map<string, string> {
  const content = /<meta http-equiv="content-security-policy" content="([^"]*)"/.exec(html)?.[1];
  const directives = new Map<string, string>();
  for (const part of (content ?? '').split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) {
      directives.set(name, values.join(' '));
    }
  }
  return directives;
}

describe('security headers (_headers)', () => {
  it.each([
    'X-Content-Type-Options: nosniff',
    'X-Frame-Options: DENY',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy: same-origin',
    "Content-Security-Policy: frame-ancestors 'none'",
    'Permissions-Policy: camera=()',
  ])('sets %s', (header) => {
    expect(headersFile).toContain(header);
  });

  it('caches hashed build assets immutably', () => {
    expect(headersFile).toMatch(
      /\/_astro\/\*\s+Cache-Control: public, max-age=31536000, immutable/,
    );
  });
});

describe('content security policy (meta element on every page)', () => {
  it('exists and locks down the base directives', () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const { file, html } of pages) {
      const csp = cspOf(html);
      expect(csp.get('default-src'), file).toBe("'self'");
      expect(csp.get('object-src'), file).toBe("'none'");
      expect(csp.get('base-uri'), file).toBe("'self'");
      expect(csp.get('frame-src'), file).toBe("'none'");
    }
  });

  it('allows scripts only from this origin and hashes, never unsafe-inline or unsafe-eval', () => {
    for (const { file, html } of pages) {
      const scriptSrc = cspOf(html).get('script-src') ?? '';
      expect(scriptSrc, file).toContain("'self'");
      expect(scriptSrc, file).not.toContain('unsafe-inline');
      expect(scriptSrc, file).not.toContain('unsafe-eval');
    }
  });

  it('allows no external hosts or wildcards anywhere', () => {
    for (const { file, html } of pages) {
      for (const [directive, value] of cspOf(html)) {
        expect(value, `${file} ${directive}`).not.toMatch(/https?:|\*/);
      }
    }
  });

  it('only allows inline styles as attributes, not as style elements', () => {
    for (const { file, html } of pages) {
      const csp = cspOf(html);
      expect(csp.get('style-src'), file).not.toContain('unsafe-inline');
      expect(csp.get('style-src-attr'), file).toBe("'unsafe-inline'");
    }
  });
});

describe('assets stay compatible with the policy', () => {
  it('has no data: URIs in the stylesheets (font-src and img-src only allow this origin)', () => {
    expect(stylesheets.length).toBeGreaterThan(0);
    for (const { file, html } of stylesheets) {
      expect(html, file).not.toMatch(/url\(\s*["']?data:/);
    }
  });

  it('has no executable inline scripts', () => {
    for (const { file, html } of pages) {
      expect(html, file).not.toMatch(
        /<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>/,
      );
    }
  });
});
