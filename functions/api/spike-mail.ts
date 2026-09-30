import { sendMail, type SmtpEnv } from '../_lib/smtp-mailer';

/**
 * TEMPORARY spike endpoint (delete it before the contact form goes live).
 * Sends exactly one fixed test mail through the IONOS mailbox, to prove that SMTP works from
 * Cloudflare. It is protected by a token because preview deployments are publicly reachable.
 */
interface Env extends SmtpEnv {
  MAIL_FROM: string;
  MAIL_TO: string;
  // Missing when the secret is not configured
  SPIKE_TOKEN?: string;
}

const MIN_TOKEN_LENGTH = 24;

function tokensMatch(expected: string, given: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(expected);
  const b = encoder.encode(given);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Refuse to run at all with a missing or weak token: nobody may trigger mails by accident
  const expectedToken = env.SPIKE_TOKEN ?? '';
  if (expectedToken.length < MIN_TOKEN_LENGTH) {
    return json({ ok: false, error: 'spike is not configured' }, 503);
  }
  if (!tokensMatch(expectedToken, request.headers.get('x-spike-token') ?? '')) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const started = Date.now();
  try {
    await sendMail(env, {
      from: env.MAIL_FROM,
      to: env.MAIL_TO,
      subject: 'leonkrix.dev SMTP spike',
      text: [
        'This is a test mail sent from a Cloudflare Pages Function through the IONOS mailbox.',
        '',
        `Sent at: ${new Date().toISOString()}`,
        `Cloudflare data center: ${request.cf?.colo ?? 'local (not on Cloudflare)'}`,
      ].join('\n'),
    });
    return json(
      { ok: true, milliseconds: Date.now() - started, colo: request.cf?.colo ?? null },
      200,
    );
  } catch (error) {
    // The message may name the SMTP server's answer, never the password (it is not part of it)
    const message = error instanceof Error ? error.message : String(error);
    return json(
      { ok: false, milliseconds: Date.now() - started, error: message.slice(0, 300) },
      502,
    );
  }
};
