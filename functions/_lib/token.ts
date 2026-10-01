/**
 * Signed time token against simple bots. The page asks for a token when the form loads; the server
 * only accepts a submission whose token is genuine (signed with the secret FORM_SECRET), at least
 * a few seconds old (a person needs time to write) and not older than an hour. Format:
 * "v1.<milliseconds since epoch>.<HMAC-SHA-256 signature, base64url>".
 */

export const TOKEN_MIN_AGE_MS = 3_000;
export const TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
/** Tolerance for a clock that is slightly off between the Cloudflare machines */
const CLOCK_SKEW_MS = 5_000;
export const MIN_SECRET_LENGTH = 32;

const encoder = new TextEncoder();

export type TokenCheck =
  'ok' | 'missing' | 'malformed' | 'invalid' | 'too_fast' | 'expired' | 'from_the_future';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function fromBase64Url(text: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9_-]+$/u.test(text)) {
    return undefined;
  }
  const base64 = text.replace(/-/gu, '+').replace(/_/gu, '/');
  try {
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createToken(secret: string, now: number): Promise<string> {
  const payload = `v1.${String(now)}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function checkToken(secret: string, token: unknown, now: number): Promise<TokenCheck> {
  if (typeof token !== 'string' || token.length === 0) {
    return 'missing';
  }
  const parts = token.split('.');
  const [version, issued, signatureText] = parts;
  if (
    parts.length !== 3 ||
    version !== 'v1' ||
    issued === undefined ||
    signatureText === undefined ||
    !/^\d{1,15}$/u.test(issued)
  ) {
    return 'malformed';
  }
  const signature = fromBase64Url(signatureText);
  if (signature === undefined) {
    return 'malformed';
  }

  // crypto.subtle.verify compares in constant time
  const genuine = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signature,
    encoder.encode(`v1.${issued}`),
  );
  if (!genuine) {
    return 'invalid';
  }

  const age = now - Number(issued);
  if (age < -CLOCK_SKEW_MS) {
    return 'from_the_future';
  }
  if (age < TOKEN_MIN_AGE_MS) {
    return 'too_fast';
  }
  if (age > TOKEN_MAX_AGE_MS) {
    return 'expired';
  }
  return 'ok';
}
