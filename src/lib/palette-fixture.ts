import { encodeBase64 } from './obfuscate';
import type { PaletteData } from './palette-data';

/** A small site for the tests of the palette and the terminal (not part of the build) */
export const fixture: PaletteData = {
  places: [
    { label: 'About', href: '/#about' },
    { label: 'Projects', href: '/#projects' },
    { label: 'Contact', href: '/#contact' },
    { label: 'All games', href: '/games/' },
    { label: 'Behind the scenes', href: '/notes/' },
    { label: 'Uses', href: '/uses/' },
  ],
  games: [
    {
      slug: 'tech-words',
      name: 'Tech Words',
      tag: 'Words',
      description: 'Guess the tech word',
      href: '/games/tech-words/',
    },
    {
      slug: 'word-radar',
      name: 'Word Radar',
      tag: 'ML',
      description: 'Find the hidden word by its closeness',
      href: '/games/word-radar/',
    },
  ],
  notes: [
    {
      slug: 'word-radar',
      title: 'Word Radar',
      summary: 'How the closeness of words is worked out',
      tag: 'ML · Word Radar',
      href: '/notes/word-radar/',
    },
    {
      slug: 'a-page-that-never-moves',
      title: 'A page that never moves',
      summary: 'The layout guard',
      tag: 'Layout',
      href: '/notes/a-page-that-never-moves/',
    },
  ],
  projects: [
    {
      id: 'defuze',
      title: 'Defuze',
      subtitle: 'A MERN app with a machine learning model',
      period: '2024',
      href: '/#project-defuze',
    },
    {
      id: 'master-thesis',
      title: 'Master thesis',
      subtitle: 'Graph neural networks and reinforcement learning',
      period: '2024 – 2025',
      href: '/#project-master-thesis',
    },
  ],
  links: [
    { label: 'GitHub', href: 'https://github.com/leonkrix' },
    { label: 'Source code of this site', href: 'https://github.com/leonkrix/leonkrix.dev' },
  ],
  legal: [
    { label: 'Legal notice', href: '/legal-notice' },
    { label: 'Privacy policy', href: '/privacy-policy' },
  ],
  uses: [
    { label: 'OS', value: 'Windows 11' },
    { label: 'Editor', value: 'JetBrains IDEs' },
  ],
  commits: [
    { hash: 'abc1234', subject: 'feat: add the uses page (#56)' },
    { hash: 'def5678', subject: 'fix: a thing' },
  ],
  about: {
    name: 'Leon Krix',
    role: 'Software Engineer',
    lines: ['Machine learning, systems, web and mobile software.', 'Polishing this website'],
  },
  email: encodeBase64('hello@example.test'),
};
