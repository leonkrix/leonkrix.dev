import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { ADDRESS_PLACEHOLDERS } from '../../src/lib/legal';
import { whymail } from '../../src/lib/whymail';
import { distDir, type Page, readDistFile, readPages } from './helpers';

/**
 * The privacy policy of the WhyMail app (/whymail/datenschutz/), which is entered in the Google Play
 * Console. The address must never change, the text must be complete in both languages, and neither
 * the postal address nor the email address may be readable in the HTML.
 */
let policy: Page | undefined;

beforeAll(async () => {
  policy = (await readPages()).find(({ file }) => file.includes(join('whymail', 'datenschutz')));
});

const html = (): string => policy?.html ?? '';
const sectionHtml = (language: 'en' | 'de'): string => {
  const start = html().indexOf(`<section lang="${language}" id="${language}"`);
  const end = html().indexOf('</section>', start);
  return start < 0 ? '' : html().slice(start, end);
};
const textOf = (fragment: string): string =>
  fragment
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');

describe('the page of the WhyMail privacy policy', () => {
  it('exists at the address that is entered in the Play Console', () => {
    expect(whymail.policyPath).toBe('/whymail/datenschutz/');
    expect(existsSync(join(distDir, 'whymail', 'datenschutz', 'index.html'))).toBe(true);
  });

  it('is reachable under the English addresses, which redirect permanently', async () => {
    const redirects = await readDistFile('_redirects');
    for (const alias of whymail.policyAliases) {
      expect(redirects, alias).toMatch(
        new RegExp(`^${alias}/?\\s+/whymail/datenschutz\\s+301$`, 'm'),
      );
    }
  });

  it('is noindex, not in the sitemap and says what it is', async () => {
    expect(html()).toContain('<meta name="robots" content="noindex">');
    expect(await readDistFile('sitemap.xml')).not.toContain('whymail');
    expect(html()).toMatch(/<title>[^<]*WhyMail[^<]*<\/title>/);
  });

  it('has an English and a German version, English first, with the same sections', () => {
    expect(html().indexOf('<section lang="en"')).toBeGreaterThan(-1);
    expect(html().indexOf('<section lang="de"')).toBeGreaterThan(
      html().indexOf('<section lang="en"'),
    );
    const numbers = (language: 'en' | 'de'): string[] =>
      [...sectionHtml(language).matchAll(/<h3[^>]*>(\d+)\./g)].map((match) => match[1] ?? '');
    expect(numbers('en')).toHaveLength(10);
    expect(numbers('de')).toEqual(numbers('en'));
  });

  it('has the date of the version in both languages', () => {
    expect(textOf(sectionHtml('en'))).toMatch(/Last updated: \d+ \w+ \d{4}/);
    expect(textOf(sectionHtml('de'))).toMatch(/Stand: \d+\. \w+ \d{4}/);
  });

  it('has the table of what the app sends, in a region that can be reached with the keyboard', () => {
    for (const language of ['en', 'de'] as const) {
      const section = sectionHtml(language);
      expect(section, language).toMatch(
        /<div class="table-scroll" role="region" tabindex="0" aria-label="[^"]+">\s*<table>/,
      );
      expect(section, language).toContain('autoconfig.thunderbird.net');
    }
  });

  it('names the publisher, links the legal notice and the privacy policy of this site', () => {
    for (const language of ['en', 'de'] as const) {
      const section = sectionHtml(language);
      expect(section, language).toContain('<address>');
      expect(section, language).toContain('href="/legal-notice/"');
    }
    expect(html()).toContain('href="/privacy-policy/"');
  });

  it('shows no placeholder, no phone number and no word of the notes for the team', () => {
    const text = textOf(html());
    expect(text).not.toMatch(/\[[A-ZÄÖÜ][A-ZÄÖÜ ]+\]/);
    for (const placeholder of Object.values(ADDRESS_PLACEHOLDERS)) {
      expect(text).not.toContain(placeholder);
    }
    expect(textOf(sectionHtml('en'))).not.toContain('Phone:');
    expect(textOf(sectionHtml('de'))).not.toContain('Telefon:');
    expect(text).not.toMatch(/Notes for the team/i);
  });

  it('never has the email address in the HTML as text or as a link', () => {
    expect(html()).not.toContain(whymail.email);
    expect(html()).not.toContain('mailto:');
    // The address of the app is drawn by CSS, like the one of this site
    expect(html()).toContain('data-protected-email=');
  });

  it('keeps the postal address out of the HTML as text', () => {
    // In the build output the address is split into words that CSS draws
    expect(html()).toContain('class="ob"');
    expect(textOf(sectionHtml('de'))).not.toMatch(/\b\d{5}\b/);
  });
});
