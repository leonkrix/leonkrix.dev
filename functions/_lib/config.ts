import type { SmtpEnv } from './smtp-mailer';

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

/** SMTP settings for the mailer: fixed server and account, password from the secret. */
export function smtpEnv(env: SecretsEnv): SmtpEnv {
  return {
    SMTP_HOST: MAIL_SETTINGS.host,
    SMTP_PORT: MAIL_SETTINGS.port,
    SMTP_USER: MAIL_SETTINGS.user,
    SMTP_PASSWORD: env.SMTP_PASSWORD,
  };
}
