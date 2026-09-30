import { WorkerMailer } from 'worker-mailer';

/** Settings for the SMTP server. The password is a secret, the rest is plain configuration. */
export interface SmtpEnv {
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
}

export interface OutgoingMail {
  from: string;
  to: string;
  /** Where a reply goes, e.g. the visitor of a contact form */
  replyTo?: string;
  subject: string;
  text: string;
}

/**
 * Sends one plain text mail through the configured SMTP server (STARTTLS, authenticated).
 * Throws when the connection, the login or the delivery fails.
 */
export async function sendMail(env: SmtpEnv, mail: OutgoingMail): Promise<void> {
  const mailer = await WorkerMailer.connect({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: false,
    startTls: true,
    authType: 'plain',
    credentials: { username: env.SMTP_USER, password: env.SMTP_PASSWORD },
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
