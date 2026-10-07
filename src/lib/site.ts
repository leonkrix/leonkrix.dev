export const siteConfig = {
  name: 'Leon Krix',
  role: 'Software Engineer',
  title: 'Leon Krix | Software Engineer',
  description:
    'Portfolio of Leon Krix, a software engineer working on machine learning, systems, web and mobile software.',
  url: 'https://leonkrix.dev',
  email: 'hello@leonkrix.dev',
  github: 'https://github.com/leonkrix',
  /** Source code of this website */
  repo: 'https://github.com/leonkrix/leonkrix.dev',
  linkedin: 'https://www.linkedin.com/in/leon-krix',
} as const;

export interface SocialLink {
  label: string;
  href: string;
  /** Icon in the form "<set>:<name>", see Icon.astro */
  icon: string;
}

/** External profiles shown as icon links. */
export const socialLinks: readonly SocialLink[] = [
  { label: 'GitHub', href: siteConfig.github, icon: 'simple-icons:github' },
  { label: 'LinkedIn', href: siteConfig.linkedin, icon: 'simple-icons:linkedin' },
];

/** Spoken languages, shown in the About section. */
export const spokenLanguages = [
  { name: 'German', level: 'native' },
  { name: 'English', level: 'fluent' },
] as const;

/**
 * What is going on right now (the "Now" block in the About section). Update the items and the month
 * whenever something changes; the month is shown next to the block so visitors can see how current
 * it is. The job search item only appears while `availability.open` is true.
 */
export const now = {
  updated: '2026-10',
  items: ['Building the games section of this site', 'Polishing this website and its tooling'],
  searching: 'Looking for my next role as a software engineer',
} as const;

/** Availability status shown as a badge in the hero. Set `open` to false to hide it. */
export const availability = {
  open: true,
  label: 'Open to opportunities',
} as const;

/**
 * Structured data (schema.org Person) for search engines.
 * Deliberately without email or address: those stay obfuscated.
 */
export const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: siteConfig.name,
  jobTitle: siteConfig.role,
  url: siteConfig.url,
  sameAs: [siteConfig.github, siteConfig.linkedin],
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'Technical University of Munich',
  },
} as const;
