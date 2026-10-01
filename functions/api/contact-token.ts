import type { FormEnv } from '../_lib/config';
import { handleToken } from '../_lib/contact-handler';

/** GET /api/contact-token: the signed time token the form sends along with the message. */
export const onRequest: PagesFunction<FormEnv> = ({ request, env }) =>
  handleToken(request, env, () => Date.now());
