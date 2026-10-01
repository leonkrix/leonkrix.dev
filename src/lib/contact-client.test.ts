import { describe, expect, it, vi } from 'vitest';

import {
  CONTACT_URL,
  type ContactValues,
  type Fetch,
  fetchToken,
  MESSAGES,
  sendContact,
  TOKEN_MIN_AGE_MS,
  TOKEN_URL,
  tokenWaitTime,
} from './contact-client';

function reply(status: number, body: unknown): Fetch {
  return vi.fn(() => Promise.resolve(Response.json(body, { status })));
}

const values: ContactValues = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello Leon, I really like your portfolio.',
  website: '',
};

describe('fetchToken', () => {
  it('returns the token and when it arrived', async () => {
    const fetchImpl = reply(200, { ok: true, token: 'v1.1.abc' });
    expect(await fetchToken(fetchImpl, () => 1000)).toEqual({
      ok: true,
      info: { token: 'v1.1.abc', receivedAt: 1000 },
    });
    expect(fetchImpl).toHaveBeenCalledWith(TOKEN_URL, expect.anything());
  });

  it('reports that the form is switched off (503)', async () => {
    expect(await fetchToken(reply(503, { ok: false }), () => 0)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it.each([
    ['a server error', reply(500, {})],
    ['a missing token', reply(200, { ok: true })],
    ['a token that is not text', reply(200, { token: 5 })],
    [
      'a body that is not JSON',
      vi.fn(() => Promise.resolve(new Response('<html>', { status: 200 }))),
    ],
    ['a network error', vi.fn(() => Promise.reject(new Error('offline')))],
  ])('reports a failure for %s', async (_label, fetchImpl) => {
    expect(await fetchToken(fetchImpl, () => 0)).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('tokenWaitTime', () => {
  const info = { token: 't', receivedAt: 10_000 };

  it('waits until the token is old enough', () => {
    expect(tokenWaitTime(info, 10_000)).toBe(TOKEN_MIN_AGE_MS);
    expect(tokenWaitTime(info, 11_000)).toBe(TOKEN_MIN_AGE_MS - 1_000);
  });

  it('does not wait for an old token', () => {
    expect(tokenWaitTime(info, 10_000 + TOKEN_MIN_AGE_MS)).toBe(0);
    expect(tokenWaitTime(info, 99_000)).toBe(0);
  });

  it('waits longer than the 3 seconds the server demands', () => {
    expect(TOKEN_MIN_AGE_MS).toBeGreaterThan(3_000);
  });
});

describe('sendContact', () => {
  it('posts JSON with the values and the token', async () => {
    const fetchImpl = reply(200, { ok: true });
    expect(await sendContact(fetchImpl, values, 'tok')).toEqual({ status: 'sent' });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
    expect(url).toBe(CONTACT_URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({ ...values, token: 'tok' });
  });

  it('hands over the field errors of the server (422)', async () => {
    const errors = { email: { code: 'invalid_email', message: 'Please enter a valid email.' } };
    expect(
      await sendContact(reply(422, { ok: false, error: 'validation', errors }), values, 't'),
    ).toEqual({
      status: 'invalid',
      errors,
    });
  });

  it('ignores field errors it does not understand', async () => {
    const body = {
      errors: { email: 'bad', other: { code: 'x', message: 'y' }, name: { code: 1 } },
    };
    expect(await sendContact(reply(422, body), values, 't')).toEqual({
      status: 'failed',
      message: MESSAGES.failed,
    });
  });

  it('asks to send again when the token was refused', async () => {
    expect(await sendContact(reply(400, { ok: false, error: 'token' }), values, 't')).toEqual({
      status: 'token',
    });
  });

  it.each([
    [429, 'rate_limited', MESSAGES.rate_limited],
    [503, 'unavailable', MESSAGES.unavailable],
    [502, 'failed', MESSAGES.failed],
    [500, 'failed', MESSAGES.failed],
    [403, 'failed', MESSAGES.failed],
    [413, 'failed', MESSAGES.failed],
  ])('maps HTTP %i to %s', async (status, expected, message) => {
    expect(await sendContact(reply(status, { ok: false }), values, 't')).toEqual({
      status: expected,
      message,
    });
  });

  it('does not trust a 200 without ok: true', async () => {
    expect((await sendContact(reply(200, {}), values, 't')).status).toBe('failed');
  });

  it('reports a network error without throwing', async () => {
    const fetchImpl: Fetch = () => Promise.reject(new Error('offline'));
    expect(await sendContact(fetchImpl, values, 't')).toEqual({
      status: 'failed',
      message: MESSAGES.network,
    });
  });

  it('survives an answer that is not JSON', async () => {
    const fetchImpl: Fetch = () => Promise.resolve(new Response('Bad gateway', { status: 502 }));
    expect((await sendContact(fetchImpl, values, 't')).status).toBe('failed');
  });
});
