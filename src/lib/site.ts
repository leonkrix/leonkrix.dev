export const siteConfig = {
  name: 'Leon Krix',
  role: 'Software Engineer',
  title: 'Leon Krix | Software Engineer',
  description:
    'Portfolio of Leon Krix, a software engineer working on machine learning, systems, web and mobile software.',
  url: 'https://leonkrix.dev',
  email: 'hello@leonkrix.dev',
  github: 'https://github.com/leonkrix',
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
