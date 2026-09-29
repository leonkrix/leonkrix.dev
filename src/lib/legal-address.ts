import { IMPRESSUM_CITY, IMPRESSUM_STREET, IMPRESSUM_ZIP } from 'astro:env/server';

import { type Address, resolveAddress } from './legal';

/** Postal address from the build variables (Cloudflare in production, `.env` locally). */
export const address: Address = resolveAddress({
  street: IMPRESSUM_STREET,
  zip: IMPRESSUM_ZIP,
  city: IMPRESSUM_CITY,
});
