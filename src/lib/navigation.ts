export interface NavLink {
  label: string;
  /** Points to a section on the home page. The leading "/" makes it work from every page. */
  href: `/#${string}`;
}

export const navLinks: readonly NavLink[] = [
  { label: 'About', href: '/#about' },
  { label: 'Projects', href: '/#projects' },
  { label: 'Experience', href: '/#experience' },
  { label: 'Contact', href: '/#contact' },
];
