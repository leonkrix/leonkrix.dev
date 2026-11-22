/**
 * The privacy policy of the WhyMail app is written by the team of the app (in a private repository,
 * `docs/legal/privacy-policy.md`, German and English in one file). This site publishes it, because the
 * Google Play Console needs a public address and the publisher of the app is the owner of this
 * domain. This module turns that text into the page:
 *
 *   upstream file --extractPublished--> snapshot (src/texts/whymail/privacy-policy.upstream.md)
 *   snapshot --toMdx--> src/texts/whymail/privacy-policy.mdx (rendered by src/pages/whymail/datenschutz.astro)
 *
 * What the publisher fills in is never in the text: the name and the address come from the build
 * variables of the site, like in the legal notice and the privacy policy of this site, and are drawn
 * by CSS, so they are not in the HTML as text. The conversion is strict: a placeholder that it does
 * not know, an unknown line in the address block or a second email address stops it, so nothing
 * unexpected is published. The scripts (scripts/whymail-policy.ts) and the daily check of the
 * workflow use these functions, and `whymail-policy.test.ts` tests them.
 *
 * Pure functions only (no file access), so the tests need no files.
 */
import { createHash } from 'node:crypto';

import { whymail } from './whymail.ts';

export class PolicyError extends Error {}

/** The first line of the part of the file that is published. Everything above it is for the team. */
export const PUBLISHED_START = '# Datenschutzerklärung WhyMail';
const ENGLISH_START = '# Privacy policy of WhyMail';

interface Language {
  code: 'de' | 'en';
  name: string;
  address: string;
  /** The whole line with the phone number. It is not published: the legal notice stands in its place. */
  phone: string;
  emailLabel: string;
  authority: string;
  /** What stands in the place of the supervisory authority: the same general wording as the privacy policy of this site, no state is named */
  authorityText: string;
  imprint: string;
}

const LANGUAGES: Record<'de' | 'en', Language> = {
  de: {
    code: 'de',
    name: '[NAME DES HERAUSGEBERS]',
    address: '[ANSCHRIFT]',
    phone: 'Telefon: [TELEFON]',
    emailLabel: 'E-Mail:',
    authority: '[AUFSICHTSBEHÖRDE]',
    authorityText:
      'der Datenschutzaufsichtsbehörde des Bundeslandes, in dem der Herausgeber seinen Wohnsitz hat',
    imprint: 'Impressum',
  },
  en: {
    code: 'en',
    name: '[NAME OF THE PUBLISHER]',
    address: '[ADDRESS]',
    phone: 'Phone: [PHONE]',
    emailLabel: 'Email:',
    authority: '[SUPERVISORY AUTHORITY]',
    authorityText:
      'the data protection supervisory authority of the German state in which the publisher lives',
    imprint: 'Legal notice',
  },
};

/** Line ends as LF, no spaces at the end of a line, no empty lines at the start or the end, one final newline */
export function normalize(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''));
  while (lines[0] === '') {
    lines.shift();
  }
  while (lines.at(-1) === '') {
    lines.pop();
  }
  return `${lines.join('\n')}\n`;
}

/** The published part of the upstream file, normalized. The notes for the team above it are dropped. */
export function extractPublished(file: string): string {
  const lines = file.replace(/\r\n?/g, '\n').split('\n');
  const starts = lines.flatMap((line, index) =>
    line.trimEnd() === PUBLISHED_START ? [index] : [],
  );
  if (starts.length !== 1 || starts[0] === undefined) {
    throw new PolicyError(
      `The upstream file must have exactly one line "${PUBLISHED_START}" (it has ${String(starts.length)}).`,
    );
  }
  return normalize(lines.slice(starts[0]).join('\n'));
}

/** SHA-256 of a normalized text, as hex */
export function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** The German and the English version, each as lines (the title first, the separator removed) */
function splitLanguages(published: string): { de: string[]; en: string[] } {
  const lines = published.split('\n');
  if (lines[0] !== PUBLISHED_START) {
    throw new PolicyError(`The published text must start with "${PUBLISHED_START}".`);
  }
  const english = lines.flatMap((line, index) => (line === ENGLISH_START ? [index] : []));
  if (english.length !== 1 || english[0] === undefined) {
    throw new PolicyError(
      `The published text must have exactly one line "${ENGLISH_START}" (it has ${String(english.length)}).`,
    );
  }
  const de = lines.slice(0, english[0]);
  while (de.at(-1) === '' || de.at(-1) === '---') {
    de.pop();
  }
  const en = lines.slice(english[0]);
  while (en.at(-1) === '') {
    en.pop();
  }
  return { de, en };
}

/** Characters that mean something in MDX (an expression, a tag) are written as text */
function escapeMdx(text: string): string {
  return text.replace(/[{}<]/g, (character) => `\\${character}`);
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PLACEHOLDER = /\[[A-ZÄÖÜ][A-ZÄÖÜ ]+\]/;
const CONTACT_EMAIL = '<ContactEmail />';

/**
 * One line of text: the email address becomes the component that hides it, the supervisory authority
 * gets its general wording, and a code span stays a code span.
 */
function inline(line: string, language: Language): string {
  const pieces = line.split('`');
  if (pieces.length % 2 === 0) {
    throw new PolicyError(`A backtick is not closed: ${line}`);
  }
  return pieces
    .map((piece, index) => {
      if (index % 2 === 1) {
        return piece === whymail.email ? CONTACT_EMAIL : `\`${piece}\``;
      }
      return piece
        .replaceAll(language.authority, language.authorityText)
        .split(whymail.email)
        .map((part) => {
          if (EMAIL.test(part)) {
            throw new PolicyError(`An email address other than ${whymail.email}: ${part}`);
          }
          return escapeMdx(part);
        })
        .join(CONTACT_EMAIL);
    })
    .join('');
}

/**
 * The paragraph with the details of the publisher. Every line must be one of the four that are
 * known; the phone number is not published, a link to the legal notice of this site replaces it.
 */
function addressBlock(lines: string[], language: Language): string[] {
  const rows = lines.map((line) => {
    if (line === language.name) {
      return '<PublisherName />';
    }
    if (line === language.address) {
      return '<PublisherAddress />';
    }
    if (line === language.phone) {
      // One element per row: a line that starts with text would become a paragraph of its own
      return `<span>${language.imprint}: <a href="/legal-notice/">leonkrix.dev/legal-notice</a></span>`;
    }
    if (line === `${language.emailLabel} ${whymail.email}`) {
      return `<span>${language.emailLabel} ${CONTACT_EMAIL}</span>`;
    }
    throw new PolicyError(`An unknown line in the paragraph with the publisher: ${line}`);
  });
  const expected = 4;
  if (new Set(rows).size !== expected || rows.length !== expected) {
    throw new PolicyError(
      'The paragraph with the publisher must have name, address, phone and email once each.',
    );
  }
  return [
    '<address>',
    ...rows.flatMap((row, index) =>
      index < rows.length - 1 ? [`  ${row}`, '  <br />'] : [`  ${row}`],
    ),
    '</address>',
  ];
}

/** One language version as a section of the page */
function convertPart(lines: string[], language: Language): string[] {
  const title = lines[0]?.replace(/^# /, '') ?? '';
  const id = `whymail-${language.code}`;
  const out = [
    `<section lang="${language.code}" id="${language.code}" aria-labelledby="${id}">`,
    '',
    `<h2 id="${id}">${escapeMdx(title)}</h2>`,
  ];

  // The paragraphs of the text (a paragraph is the lines up to the next empty line)
  let current: string[] = [];
  const paragraphs: string[][] = [current];
  for (const line of lines.slice(1)) {
    if (line === '') {
      current = [];
      paragraphs.push(current);
    } else {
      current.push(line);
    }
  }

  let topic = '';
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      continue;
    }
    out.push('');
    const first = paragraph[0] ?? '';
    const heading = /^(#+) (.*)$/.exec(first);
    if (heading?.[1] !== undefined && heading[2] !== undefined) {
      if (heading[1].length !== 2 || paragraph.length !== 1) {
        throw new PolicyError(`Only headings of the second level are known: ${first}`);
      }
      // The title of the language is the second level of the page, so a topic is the third
      topic = heading[2].replace(/^\d+\.\s*/, '');
      out.push(`### ${inline(heading[2], language)}`);
    } else if (first.startsWith('|')) {
      // A table sits in a region that scrolls, so it never makes the page wider than the screen
      out.push(
        `<div class="table-scroll" role="region" tabindex="0" aria-label="${topic.replaceAll('"', "'")}">`,
        '',
        ...paragraph.map((row) => inline(row, language)),
        '',
        '</div>',
      );
    } else if (paragraph.includes(language.address)) {
      out.push(...addressBlock(paragraph, language));
    } else {
      out.push(...paragraph.map((line) => inline(line, language)));
    }
  }
  out.push('', '</section>');
  return out;
}

/** The page: MDX with the two language versions, ready for src/pages/whymail/datenschutz.astro */
export function toMdx(published: string): string {
  const { de, en } = splitLanguages(published);
  const mdx = [
    "import ContactEmail from '@/components/legal/whymail/ContactEmail.astro';",
    "import PublisherAddress from '@/components/legal/whymail/PublisherAddress.astro';",
    "import PublisherName from '@/components/legal/whymail/PublisherName.astro';",
    '',
    `{/* Made by scripts/whymail-policy.ts from privacy-policy.upstream.md (sha256 ${hashOf(published)}). Do not edit by hand: change the text in the repository of the app, then run \`pnpm whymail-policy sync <file>\`. */}`,
    '',
    // English first and German second, like the legal pages of this site; the German version is the original
    ...convertPart(en, LANGUAGES.en),
    '',
    ...convertPart(de, LANGUAGES.de),
    '',
  ].join('\n');

  const left = PLACEHOLDER.exec(mdx);
  if (left !== null) {
    throw new PolicyError(`A placeholder is left that this conversion does not know: ${left[0]}`);
  }
  return mdx;
}
