import { describe, expect, it } from 'vitest';

import { hasOnlyInternalLinks, highlightParts, plainHighlight } from './highlights';

describe('highlightParts', () => {
  it('keeps plain text as one piece', () => {
    expect(highlightParts('Static site on Cloudflare.')).toEqual([
      { text: 'Static site on Cloudflare.' },
    ]);
  });

  it('cuts links out of the text, in order', () => {
    expect(highlightParts('Read [Behind the scenes](/notes/) and [more](/games/) now.')).toEqual([
      { text: 'Read ' },
      { text: 'Behind the scenes', href: '/notes/' },
      { text: ' and ' },
      { text: 'more', href: '/games/' },
      { text: ' now.' },
    ]);
  });

  it('handles a link at the start and at the end', () => {
    expect(highlightParts('[A](/a/) b [C](/c/)')).toEqual([
      { text: 'A', href: '/a/' },
      { text: ' b ' },
      { text: 'C', href: '/c/' },
    ]);
  });
});

describe('hasOnlyInternalLinks', () => {
  it('accepts plain text and links to this site', () => {
    expect(hasOnlyInternalLinks('Plain text, with (brackets) in it.')).toBe(true);
    expect(hasOnlyInternalLinks('See [notes](/notes/).')).toBe(true);
  });

  it('refuses links to other sites, protocol-relative links and broken markup', () => {
    expect(hasOnlyInternalLinks('See [site](https://example.com).')).toBe(false);
    expect(hasOnlyInternalLinks('See [site](//example.com).')).toBe(false);
    expect(hasOnlyInternalLinks('See [site](javascript:alert(1)).')).toBe(false);
    expect(hasOnlyInternalLinks('A [broken link](/notes/ here.')).toBe(false);
  });
});

describe('plainHighlight', () => {
  it('writes the links as plain words', () => {
    expect(plainHighlight('Read [Behind the scenes](/notes/) now.')).toBe(
      'Read Behind the scenes now.',
    );
  });
});
