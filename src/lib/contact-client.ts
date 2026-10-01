import type { ContactErrors, ContactField, FieldError } from './contact';

/**
 * Talking to the contact API from the browser, without any DOM access, so it can be unit tested
 * with a fake `fetch`. The page script (ContactForm.astro) only connects this to the elements.
 */

export const TOKEN_URL = '/api/contact-token';
export const CONTACT_URL = '/api/contact';
/** The server refuses a token younger than 3 seconds, so we wait a little longer than that. */
export const TOKEN_MIN_AGE_MS = 3_200;

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface TokenInfo {
  token: string;
  /** Local time when the token arrived, to wait until it is old enough */
  receivedAt: number;
}

export type TokenResult =
  { ok: true; info: TokenInfo } | { ok: false; reason: 'unavailable' | 'failed' };

export type SubmitResult =
  | { status: 'sent' }
  | { status: 'invalid'; errors: ContactErrors }
  | { status: 'token' }
  | { status: 'rate_limited' | 'unavailable' | 'failed'; message: string };

export interface ContactValues {
  name: string;
  email: string;
  message: string;
  /** Honeypot: stays empty for people */
  website: string;
}

export const MESSAGES = {
  rate_limited: 'Too many messages in a short time. Please try again later.',
  unavailable: 'The contact form is not available right now. Please write an email instead.',
  failed: 'Your message could not be sent. Please try again or write an email instead.',
  network: 'No connection to the server. Please check your connection and try again.',
  token: 'The form expired. Please send your message again.',
} as const;

const FIELDS: readonly ContactField[] = ['name', 'email', 'message'];

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function fetchToken(fetchImpl: Fetch, now: () => number): Promise<TokenResult> {
  try {
    const response = await fetchImpl(TOKEN_URL, { headers: { Accept: 'application/json' } });
    if (response.status === 503) {
      return { ok: false, reason: 'unavailable' };
    }
    const body = await readJson(response);
    if (response.ok && typeof body.token === 'string') {
      return { ok: true, info: { token: body.token, receivedAt: now() } };
    }
  } catch {
    // network error
  }
  return { ok: false, reason: 'failed' };
}

/** Milliseconds to wait until the token is old enough for the server. */
export function tokenWaitTime(info: TokenInfo, now: number): number {
  return Math.max(0, info.receivedAt + TOKEN_MIN_AGE_MS - now);
}

/** Field errors from the server, reduced to what we know how to show. */
function parseFieldErrors(value: unknown): ContactErrors {
  const errors: ContactErrors = {};
  if (typeof value !== 'object' || value === null) {
    return errors;
  }
  for (const field of FIELDS) {
    const entry = (value as Record<string, unknown>)[field];
    if (typeof entry === 'object' && entry !== null) {
      const { code, message } = entry as Record<string, unknown>;
      if (typeof code === 'string' && typeof message === 'string') {
        errors[field] = { code, message } as FieldError;
      }
    }
  }
  return errors;
}

export async function sendContact(
  fetchImpl: Fetch,
  values: ContactValues,
  token: string,
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetchImpl(CONTACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...values, token }),
    });
  } catch {
    return { status: 'failed', message: MESSAGES.network };
  }

  const body = await readJson(response);
  if (response.ok && body.ok === true) {
    return { status: 'sent' };
  }
  if (response.status === 422) {
    const errors = parseFieldErrors(body.errors);
    if (Object.keys(errors).length > 0) {
      return { status: 'invalid', errors };
    }
  }
  if (response.status === 400 && body.error === 'token') {
    return { status: 'token' };
  }
  if (response.status === 429) {
    return { status: 'rate_limited', message: MESSAGES.rate_limited };
  }
  if (response.status === 503) {
    return { status: 'unavailable', message: MESSAGES.unavailable };
  }
  return { status: 'failed', message: MESSAGES.failed };
}
