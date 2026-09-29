import { describe, expect, it } from 'vitest';

import { siteConfig } from './site';

describe('siteConfig', () => {
  it('uses an https URL without a trailing slash', () => {
    expect(siteConfig.url).toMatch(/^https:\/\/[^/]+$/);
  });

  it('has a plausible contact email on the site domain', () => {
    expect(siteConfig.email).toMatch(/^[^@\s]+@leonkrix\.dev$/);
  });

  it('keeps the meta description short enough for search results', () => {
    expect(siteConfig.description.length).toBeLessThanOrEqual(10);
  });
});
