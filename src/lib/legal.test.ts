import { describe, expect, it } from 'vitest';

import { ADDRESS_PLACEHOLDERS, resolveAddress } from './legal';

describe('resolveAddress', () => {
  it('uses the provided values', () => {
    const address = resolveAddress({ street: 'Beispielweg 1', zip: '12345', city: 'Berlin' });
    expect(address).toEqual({
      street: 'Beispielweg 1',
      zip: '12345',
      city: 'Berlin',
      isPlaceholder: false,
    });
  });

  it('falls back to placeholders when values are missing', () => {
    const address = resolveAddress({});
    expect(address.street).toBe(ADDRESS_PLACEHOLDERS.street);
    expect(address.zip).toBe(ADDRESS_PLACEHOLDERS.zip);
    expect(address.city).toBe(ADDRESS_PLACEHOLDERS.city);
    expect(address.isPlaceholder).toBe(true);
  });

  it('treats blank values as missing and trims the rest', () => {
    const address = resolveAddress({ street: '  Beispielweg 1 ', zip: '   ', city: 'Berlin' });
    expect(address.street).toBe('Beispielweg 1');
    expect(address.zip).toBe(ADDRESS_PLACEHOLDERS.zip);
    expect(address.isPlaceholder).toBe(true);
  });
});
