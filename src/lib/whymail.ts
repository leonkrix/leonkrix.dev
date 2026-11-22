/**
 * WhyMail is an Android app. This site publishes its privacy policy (the address that is entered in
 * the Google Play Console), see src/lib/whymail-policy.ts and src/pages/whymail/datenschutz.astro.
 */
export const whymail = {
  name: 'WhyMail',
  /** For all questions about privacy and for the reports of the app. It is public in the store anyway. */
  email: 'whymail.app@gmail.com',
  /** The address of the privacy policy page. It is entered in the Play Console: never change it. */
  policyPath: '/whymail/datenschutz/',
  /** Old and alternative addresses that lead to the page (public/_redirects) */
  policyAliases: ['/whymail/privacy', '/whymail/privacy-policy'],
} as const;
