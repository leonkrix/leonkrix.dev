/**
 * Helpers that keep contact data out of the plain HTML text.
 * This only stops simple crawlers and harvesters; anything that renders CSS/JS can still read it.
 */

/**
 * Escapes every character as a CSS unicode escape, e.g. "Ab" becomes "\000041\000062".
 * Used inside a CSS string so the browser renders the text while the HTML source contains none of it.
 */
export function cssEscape(text: string): string {
  return Array.from(
    text,
    (char) => `\\${(char.codePointAt(0) ?? 0).toString(16).padStart(6, '0')}`,
  ).join('');
}

/** UTF-8 safe base64, decoded again in the browser by a small script. */
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}
