import { describe, expect, it } from 'vitest';

import { consumeAttempt, hashSender, type KeyValueStore, RATE_LIMITS } from './rate-limit';

function memoryStore(): KeyValueStore & { data: Map<string, string>; ttls: number[] } {
  const data = new Map<string, string>();
  const ttls: number[] = [];
  return {
    data,
    ttls,
    get: (key) => Promise.resolve(data.get(key) ?? null),
    put: (key, value, options) => {
      data.set(key, value);
      ttls.push(options.expirationTtl);
      return Promise.resolve();
    },
  };
}

const hour = 60 * 60 * 1000;
const now = 1_800_000_000_000;

describe('hashSender', () => {
  it('is stable, hides the address and depends on the secret', async () => {
    const first = await hashSender('s'.repeat(32), '203.0.113.7');
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(first).not.toContain('203');
    expect(await hashSender('s'.repeat(32), '203.0.113.7')).toBe(first);
    expect(await hashSender('t'.repeat(32), '203.0.113.7')).not.toBe(first);
    expect(await hashSender('s'.repeat(32), '203.0.113.8')).not.toBe(first);
  });
});

describe('consumeAttempt', () => {
  it('allows the configured number per sender and then blocks that sender', async () => {
    const store = memoryStore();
    for (let index = 0; index < RATE_LIMITS.perSenderPerHour; index += 1) {
      expect(await consumeAttempt(store, 'alice', now)).toEqual({ allowed: true });
    }
    expect(await consumeAttempt(store, 'alice', now)).toEqual({ allowed: false, reason: 'sender' });
  });

  it('does not count blocked attempts and does not block other senders', async () => {
    const store = memoryStore();
    for (let index = 0; index < RATE_LIMITS.perSenderPerHour + 2; index += 1) {
      await consumeAttempt(store, 'alice', now);
    }
    expect(store.data.get(`total:${String(Math.floor(now / hour))}`)).toBe(
      String(RATE_LIMITS.perSenderPerHour),
    );
    expect(await consumeAttempt(store, 'bob', now)).toEqual({ allowed: true });
  });

  it('blocks everyone once the total limit is reached', async () => {
    const store = memoryStore();
    for (let index = 0; index < RATE_LIMITS.totalPerHour; index += 1) {
      expect(await consumeAttempt(store, `sender-${String(index)}`, now)).toEqual({
        allowed: true,
      });
    }
    expect(await consumeAttempt(store, 'someone-new', now)).toEqual({
      allowed: false,
      reason: 'total',
    });
  });

  it('starts fresh in the next hour', async () => {
    const store = memoryStore();
    for (let index = 0; index < RATE_LIMITS.perSenderPerHour; index += 1) {
      await consumeAttempt(store, 'alice', now);
    }
    expect(await consumeAttempt(store, 'alice', now + hour)).toEqual({ allowed: true });
  });

  it('lets every counter expire by itself (at least 60 seconds, as KV requires)', async () => {
    const store = memoryStore();
    await consumeAttempt(store, 'alice', now);
    expect(store.ttls.length).toBe(2);
    for (const ttl of store.ttls) {
      expect(ttl).toBeGreaterThanOrEqual(60);
    }
  });

  it('treats a damaged counter value as zero', async () => {
    const store = memoryStore();
    store.data.set(`sender:alice:${String(Math.floor(now / hour))}`, 'not a number');
    expect(await consumeAttempt(store, 'alice', now)).toEqual({ allowed: true });
  });
});
