import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FormEnv } from './config';
import { handleContact, handleToken, MAX_BODY_BYTES } from './contact-handler';
import { type KeyValueStore, RATE_LIMITS } from './rate-limit';
import type { OutgoingMail } from './smtp-mailer';
import { createToken, TOKEN_MIN_AGE_MS } from './token';

const secret = 'f'.repeat(32);
const issuedAt = 1_800_000_000_000;
const origin = 'https://leonkrix.dev';

const validBody = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello Leon, I really like your portfolio.',
};

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    get: (key) => Promise.resolve(data.get(key) ?? null),
    put: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

let sent: OutgoingMail[];
let sendMail: (mail: OutgoingMail) => Promise<void>;
let now: number;
let env: FormEnv;

beforeEach(() => {
  sent = [];
  sendMail = vi.fn((mail: OutgoingMail) => {
    sent.push(mail);
    return Promise.resolve();
  });
  now = issuedAt + TOKEN_MIN_AGE_MS + 1_000;
  env = { FORM_SECRET: secret, CONTACT_ENABLED: 'true', RATE_LIMIT: memoryStore() };
});

const deps = () => ({ now: () => now, sendMail });

async function submit(
  body: unknown,
  options: { headers?: Record<string, string>; method?: string; raw?: BodyInit } = {},
): Promise<Response> {
  const token = await createToken(secret, issuedAt);
  const payload =
    options.raw ??
    JSON.stringify(typeof body === 'object' && body !== null ? { token, ...body } : body);
  return handleContact(
    new Request(`${origin}/api/contact`, {
      method: options.method ?? 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        'cf-connecting-ip': '203.0.113.7',
        ...options.headers,
      },
      ...((options.method ?? 'POST') === 'POST' ? { body: payload } : {}),
    }),
    env,
    deps(),
  );
}

describe('POST /api/contact: success', () => {
  it('sends exactly one mail with the agreed subject and Reply-To', async () => {
    const response = await submit(validBody);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: 'hello@leonkrix.dev',
      to: 'hello@leonkrix.dev',
      replyTo: 'ada@example.com',
      subject: '[leonkrix.dev] New message from Ada Lovelace',
    });
    expect(sent[0]?.text).toContain(validBody.message);
  });

  it('ignores unknown extra fields: nobody can choose the recipient', async () => {
    const response = await submit({
      ...validBody,
      to: 'victim@example.com',
      bcc: 'victim@example.com',
    });
    expect(response.status).toBe(200);
    expect(sent[0]?.to).toBe('hello@leonkrix.dev');
    expect(JSON.stringify(sent[0])).not.toContain('victim');
  });

  it('accepts a Content-Type with a charset parameter', async () => {
    const response = await submit(validBody, {
      headers: { 'content-type': 'Application/JSON; charset=utf-8' },
    });
    expect(response.status).toBe(200);
  });

  it('never sets CORS headers', async () => {
    const response = await submit(validBody);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('POST /api/contact: request checks', () => {
  it.each(['GET', 'PUT', 'DELETE', 'PATCH'])(
    'refuses %s with 405 and an Allow header',
    async (method) => {
      const response = await submit(validBody, { method });
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
      expect(sent).toHaveLength(0);
    },
  );

  it.each([
    ['a foreign origin', { origin: 'https://evil.example' }],
    ['a look-alike origin', { origin: 'https://leonkrix.dev.evil.example' }],
    ['another scheme', { origin: 'http://leonkrix.dev' }],
    ['the literal null origin', { origin: 'null' }],
    ['Sec-Fetch-Site cross-site', { 'sec-fetch-site': 'cross-site' }],
    ['Sec-Fetch-Site same-site', { 'sec-fetch-site': 'same-site' }],
  ])('refuses %s with 403', async (_label, headers) => {
    const response = await submit(validBody, { headers });
    expect(response.status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it('refuses a request without Origin header', async () => {
    const request = new Request(`${origin}/api/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, token: await createToken(secret, issuedAt) }),
    });
    expect((await handleContact(request, env, deps())).status).toBe(403);
  });

  it('accepts the own origin of a preview deployment', async () => {
    const preview = 'https://abc123.leonkrix-dev.pages.dev';
    const request = new Request(`${preview}/api/contact`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: preview,
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({ ...validBody, token: await createToken(secret, issuedAt) }),
    });
    expect((await handleContact(request, env, deps())).status).toBe(200);
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', ''])(
    'refuses the content type %j with 415',
    async (contentType) => {
      const response = await submit(validBody, { headers: { 'content-type': contentType } });
      expect(response.status).toBe(415);
      expect(sent).toHaveLength(0);
    },
  );

  it('refuses a body above the size limit with 413', async () => {
    const response = await submit(null, {
      raw: JSON.stringify({ message: 'x'.repeat(MAX_BODY_BYTES) }),
    });
    expect(response.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it.each(['not json', '{"broken":', '[]', '"text"', '42', 'null', ''])(
    'refuses the body %j with 400',
    async (raw) => {
      const response = await submit(null, { raw });
      expect(response.status).toBe(400);
      expect(sent).toHaveLength(0);
    },
  );

  it('refuses a body that is not valid UTF-8 with 413', async () => {
    const response = await submit(null, { raw: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) });
    expect(response.status).toBe(413);
  });
});

describe('POST /api/contact: switched off or not configured', () => {
  it.each([
    ['the switch is missing', { CONTACT_ENABLED: undefined }],
    ['the switch is not exactly true', { CONTACT_ENABLED: 'TRUE' }],
    ['the secret is missing', { FORM_SECRET: undefined }],
    ['the secret is too short', { FORM_SECRET: 'short' }],
    ['the KV namespace is not bound', { RATE_LIMIT: undefined }],
  ])('answers 503 when %s', async (_label, change) => {
    env = { ...env, ...change };
    const response = await submit(validBody);
    expect(response.status).toBe(503);
    expect(sent).toHaveLength(0);
  });
});

describe('POST /api/contact: spam protection', () => {
  it('pretends success for a filled honeypot but sends nothing', async () => {
    const response = await submit({ ...validBody, website: 'https://spam.example' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('catches the honeypot even without a token', async () => {
    const response = await submit(null, {
      raw: JSON.stringify({ ...validBody, website: 'spam' }),
    });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it('refuses a missing token', async () => {
    const response = await submit(null, { raw: JSON.stringify(validBody) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'token' });
    expect(sent).toHaveLength(0);
  });

  it('refuses a submission that came too fast', async () => {
    now = issuedAt + 500;
    expect((await submit(validBody)).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('refuses an expired token', async () => {
    now = issuedAt + 2 * 60 * 60 * 1000;
    expect((await submit(validBody)).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('refuses a forged token', async () => {
    const forged = await createToken('0'.repeat(32), issuedAt);
    const response = await submit(null, { raw: JSON.stringify({ ...validBody, token: forged }) });
    expect(response.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('refuses a token that is not a string', async () => {
    const response = await submit(null, { raw: JSON.stringify({ ...validBody, token: { a: 1 } }) });
    expect(response.status).toBe(400);
  });
});

describe('POST /api/contact: validation', () => {
  it('answers 422 with the errors of all invalid fields', async () => {
    const response = await submit({ name: '', email: 'nope', message: 'short' });
    expect(response.status).toBe(422);
    const body = JSON.parse(await response.text()) as {
      error: string;
      errors: Record<string, unknown>;
    };
    expect(body.error).toBe('validation');
    expect(Object.keys(body.errors).sort()).toEqual(['email', 'message', 'name']);
    expect(sent).toHaveLength(0);
  });

  it('refuses a header injection attempt through the email', async () => {
    const response = await submit({
      ...validBody,
      email: 'a@example.com\r\nBcc: victim@example.com',
    });
    expect(response.status).toBe(422);
    expect(sent).toHaveLength(0);
  });

  it('refuses a header injection attempt through the name', async () => {
    const response = await submit({ ...validBody, name: 'Eve\u0000\u0007' });
    expect(response.status).toBe(422);
    expect(sent).toHaveLength(0);
  });

  it.each([42, null, ['a'], { a: 1 }])('refuses the non-string name %j', async (name) => {
    expect((await submit({ ...validBody, name })).status).toBe(422);
  });

  it('does not use up the rate limit with invalid submissions', async () => {
    for (let index = 0; index < RATE_LIMITS.perSenderPerHour + 2; index += 1) {
      await submit({ ...validBody, message: 'short' });
    }
    expect((await submit(validBody)).status).toBe(200);
  });
});

describe('POST /api/contact: rate limit', () => {
  it('blocks a sender after the allowed number of messages', async () => {
    for (let index = 0; index < RATE_LIMITS.perSenderPerHour; index += 1) {
      expect((await submit(validBody)).status).toBe(200);
    }
    const blocked = await submit(validBody);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('3600');
    expect(sent).toHaveLength(RATE_LIMITS.perSenderPerHour);
  });

  it('keeps counting separately per sender', async () => {
    for (let index = 0; index < RATE_LIMITS.perSenderPerHour; index += 1) {
      await submit(validBody);
    }
    const other = await submit(validBody, { headers: { 'cf-connecting-ip': '198.51.100.9' } });
    expect(other.status).toBe(200);
  });

  it('limits the total across all senders', async () => {
    for (let index = 0; index < RATE_LIMITS.totalPerHour; index += 1) {
      const response = await submit(validBody, {
        headers: { 'cf-connecting-ip': `198.51.100.${String(index)}` },
      });
      expect(response.status).toBe(200);
    }
    const blocked = await submit(validBody, { headers: { 'cf-connecting-ip': '192.0.2.1' } });
    expect(blocked.status).toBe(429);
  });
});

describe('POST /api/contact: mail failure', () => {
  it('answers a generic 502 without leaking details or the visitor data', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendMail = vi.fn(() =>
      Promise.reject(new Error('535 auth failed for hello@leonkrix.dev password hunter2')),
    );
    const response = await submit(validBody);
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toMatch(/535|hunter2|smtp|leonkrix\.dev/i);
    expect(text).not.toContain('ada@example.com');

    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('hunter2');
    expect(logged).not.toContain('ada@example.com');
    expect(logged).not.toContain(validBody.message);
    log.mockRestore();
  });
});

describe('GET /api/contact-token', () => {
  const get = (headers?: Record<string, string>, method = 'GET'): Promise<Response> =>
    handleToken(
      new Request(`${origin}/api/contact-token`, { method, ...(headers ? { headers } : {}) }),
      env,
      () => issuedAt,
    );

  it('hands out a token the contact endpoint accepts', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { token } = JSON.parse(await response.text()) as { token: string };
    expect(token).toBe(await createToken(secret, issuedAt));
  });

  it('works for a same-origin fetch, which sends no Origin header on GET', async () => {
    expect((await get({ 'sec-fetch-site': 'same-origin' })).status).toBe(200);
  });

  it('refuses cross-site requests', async () => {
    expect((await get({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await get({ origin: 'https://evil.example' })).status).toBe(403);
  });

  it('refuses other methods', async () => {
    const response = await get(undefined, 'POST');
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('answers 503 while the form is switched off and never reveals the secret', async () => {
    env = { ...env, CONTACT_ENABLED: 'false' };
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(secret);
  });
});
