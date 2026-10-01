/**
 * Rate limiting on Cloudflare KV, so nobody can flood the mailbox through the contact form.
 * Two counters per hour: one per sender and one for all senders together. Senders are stored
 * only as a salted hash (HMAC with the form secret) and every counter expires by itself.
 * KV is eventually consistent, so the limits are approximate, which is enough here.
 */

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

export const RATE_LIMITS = {
  perSenderPerHour: 3,
  totalPerHour: 30,
} as const;

const HOUR_MS = 60 * 60 * 1000;
/** Counters live two hours: the current hour plus a safety margin. KV needs at least 60 seconds. */
const COUNTER_TTL_SECONDS = 2 * 60 * 60;

export type RateDecision = { allowed: true } | { allowed: false; reason: 'sender' | 'total' };

/** Hash of the sender (an IP address), not reversible without the secret. */
export async function hashSender(secret: string, sender: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`sender:${sender}`));
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function readCount(store: KeyValueStore, key: string): Promise<number> {
  const value = await store.get(key);
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

/** Checks the limits and, if allowed, counts this attempt. */
export async function consumeAttempt(
  store: KeyValueStore,
  senderHash: string,
  now: number,
): Promise<RateDecision> {
  const hour = String(Math.floor(now / HOUR_MS));
  const senderKey = `sender:${senderHash}:${hour}`;
  const totalKey = `total:${hour}`;

  const [senderCount, totalCount] = await Promise.all([
    readCount(store, senderKey),
    readCount(store, totalKey),
  ]);

  if (senderCount >= RATE_LIMITS.perSenderPerHour) {
    return { allowed: false, reason: 'sender' };
  }
  if (totalCount >= RATE_LIMITS.totalPerHour) {
    return { allowed: false, reason: 'total' };
  }

  const options = { expirationTtl: COUNTER_TTL_SECONDS };
  await Promise.all([
    store.put(senderKey, String(senderCount + 1), options),
    store.put(totalKey, String(totalCount + 1), options),
  ]);
  return { allowed: true };
}
