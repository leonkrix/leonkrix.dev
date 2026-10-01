import { type FormEnv, smtpEnv } from '../_lib/config';
import { handleContact } from '../_lib/contact-handler';
import { sendMail } from '../_lib/smtp-mailer';

/** POST /api/contact. All checks live in _lib/contact-handler.ts, which is unit tested. */
export const onRequest: PagesFunction<FormEnv> = ({ request, env }) =>
  handleContact(request, env, {
    now: () => Date.now(),
    sendMail: (mail) => sendMail(smtpEnv(env), mail),
  });
