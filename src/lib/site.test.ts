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

describe('about facts data', () => {
  it('has the languages and a valid month for the now block', async () => {
    const { now, spokenLanguages } = await import('./site');
    expect(spokenLanguages.length).toBeGreaterThan(0);
    expect(now.updated).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    // The block must not claim to be updated in the future
    const current = new Date().toISOString().slice(0, 7);
    expect(now.updated <= current).toBe(true);
    expect(now.items.length).toBeGreaterThan(0);
  });

  it('points to the public repository of this site', async () => {
    const { siteConfig } = await import('./site');
    expect(siteConfig.repo).toBe('https://github.com/leonkrix/leonkrix.dev');
  });
});
