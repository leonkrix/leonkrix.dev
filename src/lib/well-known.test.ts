import { describe, expect, it } from 'vitest';

import { siteConfig } from './site';
import { expiryOf, SECURITY_TXT_VALID_DAYS, securityTxt } from './well-known';

const BUILD = new Date('2026-10-16T12:30:45.678Z');

describe('security.txt', () => {
  it('has the fields RFC 9116 requires (Contact and Expires) and names the policy', () => {
    const text = securityTxt(BUILD);
    expect(text).toContain(`Contact: mailto:${siteConfig.email}`);
    expect(text).toMatch(/^Expires: .+Z$/m);
    expect(text).toContain(`Canonical: ${siteConfig.url}/.well-known/security.txt`);
    expect(text).toContain(`Policy: ${siteConfig.repo}/blob/main/SECURITY.md`);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('expires less than a year after the build, in UTC without milliseconds', () => {
    expect(SECURITY_TXT_VALID_DAYS).toBeLessThan(365);
    expect(expiryOf(BUILD)).toBe('2027-09-11T12:30:45Z');
  });

  it('is plain ASCII, so every reader gets the same text', () => {
    // eslint-disable-next-line no-control-regex -- the point is to allow only ASCII
    expect(securityTxt(BUILD)).toMatch(/^[\x09\x0a\x20-\x7e]+$/);
  });
});
