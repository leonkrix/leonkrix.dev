/**
 * Validation rules of the contact form, shared by the browser (fast feedback) and the Cloudflare
 * Function (authoritative). Plain TypeScript without dependencies and without DOM or Workers
 * types, so both can import it.
 */

export const LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 254, localMax: 64 },
  message: { min: 20, max: 2000 },
} as const;

export type ContactField = 'name' | 'email' | 'message';

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export type FieldErrorCode =
  'required' | 'too_short' | 'too_long' | 'no_letters' | 'invalid_characters' | 'invalid_email';

export interface FieldError {
  code: FieldErrorCode;
  /** Text for the visitor */
  message: string;
}

export type ContactErrors = Partial<Record<ContactField, FieldError>>;

export type ValidationResult =
  { ok: true; value: ContactInput } | { ok: false; errors: ContactErrors };

/** Counts characters like a person does: an emoji is one character, not two. */
export function countCharacters(text: string): number {
  return Array.from(text).length;
}

// Control characters (Unicode category Cc: C0, DEL and C1), except the ones a message may contain
const CONTROL_CHARACTERS = /\p{Cc}/u;
// Bidirectional overrides and isolates can make text look different from what it says, and the
// byte order mark has no place in a message
const SPOOFING_CHARACTERS = new RegExp('[\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]', 'u');
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

const MAIL_LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const MAIL_DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const MAIL_TOP_LEVEL_DOMAIN = /^(?:[A-Za-z]{2,}|xn--[A-Za-z0-9-]{2,})$/;

/**
 * Pragmatic check for an address a person can really have: ASCII only (the address is used in a
 * mail header, where a non-ASCII domain would need extra encoding), one "@", dot separated parts
 * without empty parts, valid domain labels and a top level domain of letters. Linear time.
 */
export function isValidEmail(value: string): boolean {
  if (value.length === 0 || value.length > LIMITS.email.max) {
    return false;
  }
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@')) {
    return false;
  }
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > LIMITS.email.localMax || !MAIL_LOCAL_PART.test(local)) {
    return false;
  }
  const labels = domain.split('.');
  const topLevel = labels.at(-1);
  return (
    labels.length >= 2 &&
    labels.every((label) => MAIL_DOMAIN_LABEL.test(label)) &&
    topLevel !== undefined &&
    MAIL_TOP_LEVEL_DOMAIN.test(topLevel)
  );
}

function error(code: FieldErrorCode, message: string): { error: FieldError } {
  return { error: { code, message } };
}

type FieldResult = { value: string } | { error: FieldError };

function validateName(raw: unknown): FieldResult {
  if (typeof raw !== 'string') {
    return error('required', 'Please enter your name.');
  }
  const value = raw.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (value.length === 0) {
    return error('required', 'Please enter your name.');
  }
  if (CONTROL_CHARACTERS.test(value) || SPOOFING_CHARACTERS.test(value)) {
    return error('invalid_characters', 'Your name contains characters that are not allowed.');
  }
  if (countCharacters(value) < LIMITS.name.min) {
    return error('too_short', `Your name needs at least ${String(LIMITS.name.min)} characters.`);
  }
  if (countCharacters(value) > LIMITS.name.max) {
    return error('too_long', `Your name can have at most ${String(LIMITS.name.max)} characters.`);
  }
  if (!HAS_LETTER_OR_DIGIT.test(value)) {
    return error('no_letters', 'Please use letters in your name.');
  }
  return { value };
}

function validateEmail(raw: unknown): FieldResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return error('required', 'Please enter your email address.');
  }
  const value = raw.trim();
  if (value.length > LIMITS.email.max) {
    return error('too_long', 'This email address is too long.');
  }
  if (!isValidEmail(value)) {
    return error('invalid_email', 'Please enter a valid email address, like name@example.com.');
  }
  return { value };
}

function validateMessage(raw: unknown): FieldResult {
  if (typeof raw !== 'string') {
    return error('required', 'Please write a message.');
  }
  // Windows and old Mac line breaks become "\n", the rest is only trimmed at both ends
  const value = raw.normalize('NFC').replace(/\r\n?/gu, '\n').trim();
  if (value.length === 0) {
    return error('required', 'Please write a message.');
  }
  // Line breaks and tabs are fine in a message, other control characters are not
  if (CONTROL_CHARACTERS.test(value.replace(/[\n\t]/gu, '')) || SPOOFING_CHARACTERS.test(value)) {
    return error('invalid_characters', 'Your message contains characters that are not allowed.');
  }
  if (countCharacters(value) < LIMITS.message.min) {
    return error(
      'too_short',
      `Your message needs at least ${String(LIMITS.message.min)} characters.`,
    );
  }
  if (countCharacters(value) > LIMITS.message.max) {
    return error(
      'too_long',
      `Your message can have at most ${String(LIMITS.message.max)} characters.`,
    );
  }
  return { value };
}

/**
 * Validates and normalizes the data of the contact form. The input is untrusted (parsed JSON or
 * form data), so every field may be missing or of the wrong type. On success the returned values
 * are trimmed and normalized (Unicode NFC, collapsed spaces in the name, "\n" line breaks).
 */
export function validateContact(input: unknown): ValidationResult {
  const data: Record<string, unknown> =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const name = validateName(data.name);
  const email = validateEmail(data.email);
  const message = validateMessage(data.message);

  if ('error' in name || 'error' in email || 'error' in message) {
    return {
      ok: false,
      errors: {
        ...('error' in name ? { name: name.error } : {}),
        ...('error' in email ? { email: email.error } : {}),
        ...('error' in message ? { message: message.error } : {}),
      },
    };
  }
  return { ok: true, value: { name: name.value, email: email.value, message: message.value } };
}

/** The hidden "website" field is for bots: a person never sees it, so it must stay empty. */
export function isHoneypotFilled(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  const value = (input as Record<string, unknown>).website;
  return typeof value === 'string'
    ? value.trim().length > 0
    : value !== undefined && value !== null;
}
