import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { whymail } from './whymail.ts';
import { extractPublished, hashOf, normalize, PolicyError, toMdx } from './whymail-policy.ts';

const folder = join(import.meta.dirname, '..', 'texts', 'whymail');
const snapshot = readFileSync(join(folder, 'privacy-policy.upstream.md'), 'utf8');
const page = readFileSync(join(folder, 'privacy-policy.mdx'), 'utf8');

/** A small text with everything the conversion knows, to change one thing at a time */
function published(
  options: { germanExtra?: string; addressLine?: string; authority?: string } = {},
) {
  const {
    germanExtra = '',
    addressLine = 'E-Mail: whymail.app@gmail.com',
    authority = '[AUFSICHTSBEHÖRDE]',
  } = options;
  return normalize(`# Datenschutzerklärung WhyMail

Stand: 1. Januar 2027

## 1. Wer verantwortlich ist

[NAME DES HERAUSGEBERS]
[ANSCHRIFT]
Telefon: [TELEFON]
${addressLine}

## 2. Rechte

Beschwerde zum Beispiel bei ${authority}. ${germanExtra}

---

# Privacy policy of WhyMail

Last updated: 1 January 2027

## 1. Who is responsible

[NAME OF THE PUBLISHER]
[ADDRESS]
Phone: [PHONE]
Email: whymail.app@gmail.com

## 2. Rights

Complaint for example to [SUPERVISORY AUTHORITY].
`);
}

describe('normalize', () => {
  it('uses LF, drops spaces at the end of a line and empty lines at the edges, ends with one newline', () => {
    expect(normalize('\r\n\r\nfirst  \r\nsecond\t\r\n\r\n\r\n')).toBe('first\nsecond\n');
  });
});

describe('extractPublished', () => {
  it('drops the notes for the team above the published text', () => {
    const file = `# Privacy policy of WhyMail\n\n## Notes for the team\n\n- private detail #42\n\n---\n\n${published()}`;
    const result = extractPublished(file);
    expect(result).toBe(published());
    expect(result).not.toContain('private detail');
  });

  it('gives the same text for Windows line endings', () => {
    expect(extractPublished(`notes\n${published()}`.replaceAll('\n', '\r\n'))).toBe(published());
  });

  it('refuses a file without the start of the published text, and one with it twice', () => {
    expect(() => extractPublished('# Something else\n')).toThrow(PolicyError);
    expect(() => extractPublished(`${published()}\n${published()}`)).toThrow(PolicyError);
  });
});

describe('hashOf', () => {
  it('is the same for the same text and changes with every change', () => {
    expect(hashOf(published())).toBe(hashOf(published()));
    expect(hashOf(published({ germanExtra: 'Mehr.' }))).not.toBe(hashOf(published()));
  });
});

describe('toMdx', () => {
  it('turns the placeholders into components and the general wording of the supervisory authority', () => {
    const mdx = toMdx(published());
    expect(mdx).toContain('<PublisherName />');
    expect(mdx).toContain('<PublisherAddress />');
    expect(mdx).toContain('<ContactEmail />');
    expect(mdx).toContain(
      'zum Beispiel bei der Datenschutzaufsichtsbehörde des Bundeslandes, in dem der Herausgeber seinen Wohnsitz hat.',
    );
    expect(mdx).toContain(
      'to the data protection supervisory authority of the German state in which the publisher lives.',
    );
    expect(mdx).not.toMatch(/\[[A-ZÄÖÜ][A-ZÄÖÜ ]+\]/);
  });

  it('does not publish the phone number, a link to the legal notice takes its place', () => {
    const mdx = toMdx(published());
    expect(mdx).not.toMatch(/TELEFON|PHONE|Telefon|Phone/);
    expect(mdx).toContain('<span>Impressum: <a href="/legal-notice/">');
    expect(mdx).toContain('<span>Legal notice: <a href="/legal-notice/">');
  });

  it('writes characters that mean something in MDX as text', () => {
    const mdx = toMdx(published({ germanExtra: 'Ein {Ausdruck} und <ein Tag>.' }));
    expect(mdx).toContain('Ein \\{Ausdruck\\} und \\<ein Tag>.');
  });

  it('stops at a placeholder it does not know', () => {
    expect(() => toMdx(published({ germanExtra: 'Siehe [NEUER PLATZHALTER].' }))).toThrow(
      /\[NEUER PLATZHALTER\]/,
    );
  });

  it('stops at another email address', () => {
    expect(() => toMdx(published({ germanExtra: 'Schreib an anderer@example.org.' }))).toThrow(
      /anderer@example\.org/,
    );
  });

  it('stops at an unknown line in the paragraph with the publisher', () => {
    expect(() => toMdx(published({ addressLine: 'Fax: 123' }))).toThrow(PolicyError);
  });

  it('stops when the English version is missing', () => {
    expect(() => toMdx(published().split('---')[0] ?? '')).toThrow(PolicyError);
  });
});

describe('the policy that is published', () => {
  const sections = (language: 'de' | 'en'): string => {
    const start = page.indexOf(`<section lang="${language}"`);
    const end = page.indexOf('</section>', start);
    return page.slice(start, end);
  };
  const numbers = (language: 'de' | 'en'): string[] =>
    [...sections(language).matchAll(/^### (\d+)\./gm)].map((match) => match[1] ?? '');

  it('is stored as the normalized published text', () => {
    expect(snapshot).toBe(normalize(snapshot));
    expect(snapshot.startsWith('# Datenschutzerklärung WhyMail\n')).toBe(true);
  });

  it('is the page that the script makes from it (run `pnpm whymail-policy build` otherwise)', () => {
    expect(page).toBe(toMdx(snapshot));
  });

  it('has the same ten sections in both languages, with a date', () => {
    expect(numbers('de')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(numbers('en')).toEqual(numbers('de'));
    expect(sections('de')).toMatch(/^Stand: \d+\. \w+ \d{4}$/m);
    expect(sections('en')).toMatch(/^Last updated: \d+ \w+ \d{4}$/m);
  });

  it('has the table of the network in a region that scrolls, in both languages', () => {
    for (const language of ['de', 'en'] as const) {
      expect(sections(language)).toMatch(
        /<div class="table-scroll" role="region" tabindex="0" aria-label="[^"]+">/,
      );
    }
  });

  it('never contains the email address as text', () => {
    expect(page).not.toContain(whymail.email);
    expect(page).not.toContain('mailto:');
  });

  it('does not contain the notes for the team', () => {
    expect(snapshot).not.toMatch(/Notes for the team/i);
    expect(snapshot).not.toMatch(/#\d{2}\b/);
  });
});
