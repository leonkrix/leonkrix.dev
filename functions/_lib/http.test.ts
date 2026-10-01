import { describe, expect, it } from 'vitest';

import { json, readLimitedText } from './http';

function post(body: BodyInit | null, headers?: HeadersInit): Request {
  return new Request('https://leonkrix.dev/api/contact', {
    method: 'POST',
    body,
    ...(headers ? { headers } : {}),
  });
}

describe('json', () => {
  it('answers JSON that is never cached or sniffed', async () => {
    const response = json({ ok: true }, 201, { 'X-Test': '1' });
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-test')).toBe('1');
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe('readLimitedText', () => {
  it('reads a body within the limit, including multi-byte characters', async () => {
    expect(await readLimitedText(post('Grüße 👋'), 100)).toBe('Grüße 👋');
  });

  it('accepts a body of exactly the limit and refuses one byte more', async () => {
    expect(await readLimitedText(post('a'.repeat(10)), 10)).toBe('a'.repeat(10));
    expect(await readLimitedText(post('a'.repeat(11)), 10)).toBeUndefined();
  });

  it('counts bytes, not characters', async () => {
    expect(await readLimitedText(post('ü'.repeat(6)), 10)).toBeUndefined();
  });

  it('refuses early when Content-Length already says it is too large', async () => {
    const request = post('tiny', { 'content-length': '999999' });
    expect(await readLimitedText(request, 100)).toBeUndefined();
  });

  it('still counts the stream when Content-Length lies', async () => {
    const request = post('a'.repeat(50), { 'content-length': '5' });
    expect(await readLimitedText(request, 10)).toBeUndefined();
  });

  it('refuses a body that is not valid UTF-8', async () => {
    expect(await readLimitedText(post(new Uint8Array([0xff, 0xfe, 0x41])), 100)).toBeUndefined();
  });

  it('returns an empty string for a request without a body', async () => {
    expect(
      await readLimitedText(new Request('https://leonkrix.dev/', { method: 'POST' }), 100),
    ).toBe('');
  });
});
