import { siteConfig } from './site';

/** How long a `security.txt` is valid, counted from the build. RFC 9116 asks for less than a year. */
export const SECURITY_TXT_VALID_DAYS = 330;

const DAY = 24 * 60 * 60 * 1000;

/** `Expires` has to be an ISO 8601 date and time in UTC, without milliseconds. */
export function expiryOf(now: Date): string {
  const expires = new Date(now.getTime() + SECURITY_TXT_VALID_DAYS * DAY);
  return expires.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The text of `/.well-known/security.txt` (RFC 9116): where to report a vulnerability. The expiry is
 * set at every build (every merge, Dependabot opens one weekly), so nobody has to remember it; the
 * live check and a build-output test warn when it comes close.
 */
export function securityTxt(now: Date): string {
  return [
    '# How to report a security problem with leonkrix.dev (RFC 9116).',
    `Contact: mailto:${siteConfig.email}`,
    `Contact: ${siteConfig.repo}/security/advisories/new`,
    `Expires: ${expiryOf(now)}`,
    'Preferred-Languages: en, de',
    `Canonical: ${siteConfig.url}/.well-known/security.txt`,
    `Policy: ${siteConfig.repo}/blob/main/SECURITY.md`,
    '',
  ].join('\n');
}
