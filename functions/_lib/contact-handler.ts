import { isHoneypotFilled, validateContact } from '../../src/lib/contact';
import { activeFormSecret, type FormEnv } from './config';
import { json, readLimitedText } from './http';
import { buildMail } from './mail-text';
import { consumeAttempt, hashSender } from './rate-limit';
import type { SendMail } from './smtp-mailer';
import { checkToken, createToken } from './token';

export const MAX_BODY_BYTES = 10 * 1024;

export interface ContactDeps {
  now: () => number;
  sendMail: SendMail;
}

const NOT_AVAILABLE = 'The contact form is not available right now. Please write an email instead.';

/**
 * Cross-site requests are refused. A browser always sends Origin with a POST, so a missing or
 * foreign Origin means the request did not come from our own page. There is no CORS header at all.
 */
function isSameSite(request: Request, requireOrigin: boolean): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null && fetchSite !== 'same-origin') {
    return false;
  }
  const origin = request.headers.get('origin');
  if (origin === null) {
    return !requireOrigin;
  }
  return origin === new URL(request.url).origin;
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // not JSON
  }
  return undefined;
}

/** GET /api/contact-token: hands the page a signed time token when the form loads. */
export async function handleToken(
  request: Request,
  env: FormEnv,
  now: () => number,
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  if (!isSameSite(request, false)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  const secret = activeFormSecret(env);
  if (secret === undefined) {
    return json({ ok: false, error: 'unavailable', message: NOT_AVAILABLE }, 503);
  }
  return json({ ok: true, token: await createToken(secret, now()) });
}

/** POST /api/contact: checks the request step by step, cheapest check first, then sends the mail. */
export async function handleContact(
  request: Request,
  env: FormEnv,
  deps: ContactDeps,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  if (!isSameSite(request, true)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  const secret = activeFormSecret(env);
  if (secret === undefined || env.RATE_LIMIT === undefined) {
    return json({ ok: false, error: 'unavailable', message: NOT_AVAILABLE }, 503);
  }

  const mediaType = (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return json({ ok: false, error: 'unsupported_media_type' }, 415);
  }

  const text = await readLimitedText(request, MAX_BODY_BYTES);
  if (text === undefined) {
    return json({ ok: false, error: 'payload_too_large' }, 413);
  }
  const body = parseJsonObject(text);
  if (body === undefined) {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  // A bot filled the hidden field: pretend everything worked, send nothing, tell nothing.
  if (isHoneypotFilled(body)) {
    return json({ ok: true });
  }

  const now = deps.now();
  if ((await checkToken(secret, body.token, now)) !== 'ok') {
    return json(
      { ok: false, error: 'token', message: 'Please reload the page and try again.' },
      400,
    );
  }

  const validation = validateContact(body);
  if (!validation.ok) {
    return json({ ok: false, error: 'validation', errors: validation.errors }, 422);
  }

  const sender = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const decision = await consumeAttempt(env.RATE_LIMIT, await hashSender(secret, sender), now);
  if (!decision.allowed) {
    return json(
      { ok: false, error: 'rate_limited', message: 'Too many messages. Please try again later.' },
      429,
      { 'Retry-After': '3600' },
    );
  }

  try {
    await deps.sendMail(buildMail(validation.value));
  } catch (error) {
    // Never log the visitor's data, only that and why sending failed.
    console.error(
      'contact: sending the mail failed:',
      error instanceof Error ? error.name : 'unknown',
    );
    return json(
      {
        ok: false,
        error: 'send_failed',
        message: 'Your message could not be sent. Please write an email instead.',
      },
      502,
    );
  }
  return json({ ok: true });
}
