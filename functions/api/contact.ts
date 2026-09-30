/**
 * Placeholder for the contact form endpoint. It answers that the form is not available yet, so the
 * Functions folder is valid and deployable. The next change replaces it with the real handler
 * (validation, spam protection, mail delivery through functions/_lib/smtp-mailer.ts).
 */
export const onRequestPost: PagesFunction = () =>
  new Response(JSON.stringify({ ok: false, error: 'The contact form is not available yet.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
