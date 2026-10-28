import type { PrivacyGuardOptions } from 'playwright-privacy-guard';

/**
 * What the privacy guard looks for in every browser test (playwright.config.ts, `use`). By default
 * it fails a test on another origin, a cookie, anything stored on the device, a violation of the CSP,
 * an error, a sensitive browser API, a form that sends elsewhere, and so on. This adds two things:
 * fingerprinting (reading pixels back from a canvas, WebGL, audio, probing fonts) is an error too,
 * because the site has no reason to do any of it, and the CSP of the page is rated (a warning).
 */
export const privacyGuardOptions: PrivacyGuardOptions = {
  rules: { fingerprint: 'error', cspQuality: 'warn' },
};
