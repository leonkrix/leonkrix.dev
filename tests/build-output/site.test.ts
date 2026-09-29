import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { ADDRESS_PLACEHOLDERS } from '../../src/lib/legal';
import { siteConfig } from '../../src/lib/site';
import { distDir, type Page, readPages } from './helpers';

/**
 * Checks against the production build in dist/. Run `pnpm build` first (pnpm test:dist).
 */
let pages: Page[] = [];

beforeAll(async () => {
  pages = await readPages();
});

describe('every page', () => {
  it('has lang, title, description and canonical', () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const { file, html } of pages) {
      expect(html, file).toMatch(/<html[^>]*\slang="[a-z-]+"/);
      expect(html, file).toMatch(/<title>[^<]+<\/title>/);
      expect(html, file).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html, file).toMatch(/<link rel="canonical" href="https:\/\/leonkrix\.dev[^"]*"/);
    }
  });

  it('links to Impressum and Datenschutz in the footer', () => {
    for (const { file, html } of pages) {
      expect(html, file).toContain('href="/impressum"');
      expect(html, file).toContain('href="/datenschutz"');
    }
  });

  it('loads no insecure http:// resources', () => {
    for (const { file, html } of pages) {
      expect(html, file).not.toMatch(/(?:src|href)="http:\/\//);
    }
  });
});

describe('legal pages', () => {
  it('exist', () => {
    expect(existsSync(join(distDir, 'impressum', 'index.html'))).toBe(true);
    expect(existsSync(join(distDir, 'datenschutz', 'index.html'))).toBe(true);
  });

  it('are set to noindex', () => {
    for (const { file, html } of pages) {
      if (file.includes('impressum') || file.includes('datenschutz')) {
        expect(html, file).toContain('<meta name="robots" content="noindex">');
      }
    }
  });
});

describe('contact data protection', () => {
  const forbidden = [
    ...Object.values(ADDRESS_PLACEHOLDERS),
    siteConfig.email,
    ...['IMPRESSUM_STREET', 'IMPRESSUM_ZIP', 'IMPRESSUM_CITY']
      .map((key) => process.env[key]?.trim())
      .filter((value): value is string => value !== undefined && value !== ''),
  ];

  it('never emits the address, placeholders or the email as plain text', () => {
    for (const { file, html } of pages) {
      for (const text of forbidden) {
        expect(html, `${file} contains "${text}"`).not.toContain(text);
      }
    }
  });

  it('never emits a mailto link in the HTML', () => {
    for (const { file, html } of pages) {
      expect(html, file).not.toMatch(/href="mailto:/);
    }
  });
});
