import { WorkerMailer } from 'worker-mailer';

/** Settings for the SMTP server. The password is a secret, the rest is plain configuration. */
export interface SmtpEnv {
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: string | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
}

export interface OutgoingMail {
  from: string;
  to: string;
  /** Where a reply goes, e.g. the visitor of a contact form */
  replyTo?: string;
  subject: string;
  text: string;
}

/** The small interface the rest of the code depends on, so the mail transport can be swapped. */
export type SendMail = (mail: OutgoingMail) => Promise<void>;

/**
 * Sends one plain text mail through the configured SMTP server (STARTTLS, authenticated).
 * Throws when the configuration is incomplete, or when the connection, the login or the delivery
 * fails. Error messages never contain the password.
 */
export async function sendMail(env: SmtpEnv, mail: OutgoingMail): Promise<void> {
  const {
    SMTP_HOST: host,
    SMTP_PORT: portText,
    SMTP_USER: username,
    SMTP_PASSWORD: password,
  } = env;
  if (!host || !portText || !username || !password) {
    throw new Error('SMTP is not configured');
  }
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('SMTP_PORT is not a valid port');
  }

  const mailer = await WorkerMailer.connect({
    host,
    port,
    secure: false,
    startTls: true,
    authType: 'plain',
    credentials: { username, password },
  });

  try {
    await mailer.send({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      ...(mail.replyTo === undefined ? {} : { reply: mail.replyTo }),
    });
  } finally {
    await mailer.close();
  }
}
