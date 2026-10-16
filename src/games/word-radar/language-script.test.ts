import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { languageScript } from './language-script.mjs';
import { parseLanguage } from './logic/language';

/** Runs the script of the page against an address and returns what it wrote on the html element */
function run(search: string): string | undefined {
  const dataset: Record<string, string> = {};
  const fakeWindow = { location: { search } };
  const fakeDocument = { documentElement: { dataset } };
  runInNewContext(languageScript, { window: fakeWindow, document: fakeDocument, URLSearchParams });
  return dataset.wrLanguage;
}

describe('the inline script of the page of Word Radar', () => {
  it('says the same as parseLanguage for every address', () => {
    for (const search of [
      '',
      '?',
      '?lang=de',
      '?lang=en',
      '?lang=DE',
      '?lang=',
      '?lang=fr&x=1',
      '?x=1&lang=de',
      '?seed=5&lang=de&level=2',
      '?lang=de&lang=en',
    ]) {
      expect(run(search), `the address "${search}"`).toBe(parseLanguage(search));
    }
  });

  it('is a single statement without a line break, so that its text and its hash are exact', () => {
    expect(languageScript).not.toContain('\n');
    expect(languageScript.trim()).toBe(languageScript);
    // The hash is what the content security policy allows (computed the same way in astro.config.mjs)
    expect(createHash('sha256').update(languageScript).digest('base64')).toMatch(
      /^[A-Za-z0-9+/]{43}=$/,
    );
  });
});
