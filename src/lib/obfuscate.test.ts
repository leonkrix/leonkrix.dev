import { describe, expect, it } from 'vitest';

import { cssEscape, encodeBase64 } from './obfuscate';

/** Reverses cssEscape the way a browser reads the CSS string. */
function decodeCssEscapes(escaped: string): string {
  return escaped.replace(/\\([0-9a-f]{6})/g, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );
}

describe('cssEscape', () => {
  it('escapes every character as a 6 digit unicode escape', () => {
    expect(cssEscape('Ab')).toBe('\\000041\\000062');
  });

  it('does not leave the original text in the output', () => {
    const escaped = cssEscape('Musterstraße');
    expect(escaped).not.toContain('Muster');
    expect(escaped).not.toContain('straße');
  });

  it('round-trips, including umlauts and sharp s', () => {
    const text = 'Müllerstraße 12a';
    expect(decodeCssEscapes(cssEscape(text))).toBe(text);
  });
});

describe('encodeBase64', () => {
  it('encodes ASCII like standard base64', () => {
    expect(encodeBase64('hello@leonkrix.dev')).toBe('aGVsbG9AbGVvbmtyaXguZGV2');
  });

  it('is decodable by atob for ASCII input', () => {
    expect(atob(encodeBase64('a@b.de'))).toBe('a@b.de');
  });
});
