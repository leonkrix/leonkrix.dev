import type { KeyValueStore } from './rate-limit';
import type { SmtpEnv } from './smtp-mailer';
import { MIN_SECRET_LENGTH } from './token';

/**
 * Non-secret mail settings. They live in code on purpose: they are not secrets (the address is
 * public in the Impressum), and a Wrangler configuration file must not exist in this repository,
 * because Cloudflare Pages then ignores the variables of the dashboard at build time, including
 * the Impressum address. The only secret is the password (Cloudflare Secret SMTP_PASSWORD).
 */
export const MAIL_SETTINGS = {
  host: 'smtp.ionos.de',
  port: '587',
  user: 'hello@leonkrix.dev',
  from: 'hello@leonkrix.dev',
  to: 'hello@leonkrix.dev',
} as const;

/** The secrets Cloudflare hands to the Functions. */
export interface SecretsEnv {
  SMTP_PASSWORD?: string | undefined;
}

/**
 * What the contact form needs besides the mail password: the form secret (signs the time tokens and
 * salts the sender hashes), the on/off switch and the KV namespace for the rate limit. In the
 * dashboard: FORM_SECRET and SMTP_PASSWORD as Secrets, CONTACT_ENABLED as plain variable and the KV
 * binding named RATE_LIMIT, each for Production and Preview.
 */
export interface FormEnv extends SecretsEnv {
  FORM_SECRET?: string | undefined;
  CONTACT_ENABLED?: string | undefined;
  RATE_LIMIT?: KeyValueStore | undefined;
}

/**
 * The form secret, but only when the form is switched on (CONTACT_ENABLED is exactly "true") and the
 * secret is long enough to be one. Without it the form endpoints answer "not available".
 */
export function activeFormSecret(env: FormEnv): string | undefined {
  const secret = env.FORM_SECRET;
  if (env.CONTACT_ENABLED !== 'true' || secret === undefined || secret.length < MIN_SECRET_LENGTH) {
    return undefined;
  }
  return secret;
}

/** SMTP settings for the mailer: fixed server and account, password from the secret. */
export function smtpEnv(env: SecretsEnv): SmtpEnv {
  return {
    SMTP_HOST: MAIL_SETTINGS.host,
    SMTP_PORT: MAIL_SETTINGS.port,
    SMTP_USER: MAIL_SETTINGS.user,
    SMTP_PASSWORD: env.SMTP_PASSWORD,
  };
}
