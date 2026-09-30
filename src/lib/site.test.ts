import { describe, expect, it } from 'vitest';

import { siteConfig, socialLinks } from './site';

describe('siteConfig', () => {
  it('uses an https URL without a trailing slash', () => {
    expect(siteConfig.url).toMatch(/^https:\/\/[^/]+$/);
  });

  it('has a plausible contact email on the site domain', () => {
    expect(siteConfig.email).toMatch(/^[^@\s]+@leonkrix\.dev$/);
  });

  it('keeps the meta description short enough for search results', () => {
    expect(siteConfig.description.length).toBeLessThanOrEqual(160);
  });

  it('lists social profiles with https links and an icon', () => {
    expect(socialLinks.length).toBeGreaterThan(0);
    for (const link of socialLinks) {
      expect(link.href.startsWith('https://')).toBe(true);
      expect(link.icon).toMatch(/^[a-z-]+:[a-z0-9-]+$/);
    }
  });
});
