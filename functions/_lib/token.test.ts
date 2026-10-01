import { describe, expect, it } from 'vitest';

import { checkToken, createToken, TOKEN_MAX_AGE_MS, TOKEN_MIN_AGE_MS } from './token';

const secret = 'a'.repeat(32);
const issuedAt = 1_800_000_000_000;

describe('time token', () => {
  it('accepts a genuine token that has the right age', async () => {
    const token = await createToken(secret, issuedAt);
    expect(await checkToken(secret, token, issuedAt + TOKEN_MIN_AGE_MS)).toBe('ok');
    expect(await checkToken(secret, token, issuedAt + TOKEN_MAX_AGE_MS)).toBe('ok');
  });

  it('is URL safe and has the expected shape', async () => {
    expect(await createToken(secret, issuedAt)).toMatch(/^v1\.1800000000000\.[A-Za-z0-9_-]{43}$/);
  });

  it('rejects a submission that came too fast', async () => {
    const token = await createToken(secret, issuedAt);
    expect(await checkToken(secret, token, issuedAt + TOKEN_MIN_AGE_MS - 1)).toBe('too_fast');
    expect(await checkToken(secret, token, issuedAt)).toBe('too_fast');
  });

  it('rejects an expired token', async () => {
    const token = await createToken(secret, issuedAt);
    expect(await checkToken(secret, token, issuedAt + TOKEN_MAX_AGE_MS + 1)).toBe('expired');
  });

  it('rejects a token from the future but tolerates a little clock skew', async () => {
    const token = await createToken(secret, issuedAt);
    expect(await checkToken(secret, token, issuedAt - 60_000)).toBe('from_the_future');
    expect(await checkToken(secret, token, issuedAt - 1_000)).toBe('too_fast');
  });

  it('rejects a token signed with another secret', async () => {
    const token = await createToken('b'.repeat(32), issuedAt);
    expect(await checkToken(secret, token, issuedAt + 10_000)).toBe('invalid');
  });

  it('rejects a forged timestamp (age cannot be faked without the secret)', async () => {
    const token = await createToken(secret, issuedAt);
    const [version, , signature] = token.split('.');
    const forged = `${version ?? ''}.${String(issuedAt - 5 * 60_000)}.${signature ?? ''}`;
    expect(await checkToken(secret, forged, issuedAt + 10_000)).toBe('invalid');
  });

  it('rejects a changed signature', async () => {
    const token = await createToken(secret, issuedAt);
    const changed = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(await checkToken(secret, changed, issuedAt + 10_000)).toBe('invalid');
  });

  it.each([undefined, null, 42, {}, [], ''])('treats %j as missing', async (value) => {
    expect(await checkToken(secret, value, issuedAt)).toBe('missing');
  });

  it.each([
    'garbage',
    'v1.123',
    'v2.1800000000000.abc',
    'v1.abc.def',
    'v1.1800000000000.',
    'v1.1800000000000.a.b',
    'v1.1800000000000.!!!',
    'v1.-1.abc',
    'v1.1800000000000000000000.abc',
  ])('treats %j as malformed', async (value) => {
    expect(await checkToken(secret, value, issuedAt)).toBe('malformed');
  });
});
