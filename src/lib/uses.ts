/**
 * The content of the Uses page (/uses/): what I work with. Plain data, so the page, the tests and
 * the text stay in one place. Keep it short and true; change `updated` whenever something changes.
 */

export interface UsesLine {
  /** Short label in the terminal block, like the keys of neofetch */
  label: string;
  value: string;
}

export interface UsesItem {
  name: string;
  /** One short line: what it is used for, or a fact worth knowing */
  detail?: string;
}

export interface UsesCategory {
  id: string;
  title: string;
  /** Icon in the form "<set>:<name>", see Icon.astro */
  icon: string;
  items: readonly UsesItem[];
}

/** Month of the last change, YYYY-MM */
export const usesUpdated = '2026-10';

/** The terminal block at the top of the page: the short version of everything below */
export const usesSummary: readonly UsesLine[] = [
  { label: 'OS', value: 'Windows 11, Debian 13 (dual boot)' },
  { label: 'Host', value: 'Desktop PC' },
  { label: 'CPU', value: 'AMD Ryzen 7 5800X' },
  { label: 'GPU', value: 'GeForce RTX 3070' },
  { label: 'Memory', value: '32 GB' },
  { label: 'Laptop', value: 'ASUS Zenbook 14 OLED' },
  { label: 'Shell', value: 'PowerShell, Bash' },
  { label: 'Editor', value: 'JetBrains IDEs' },
  { label: 'Browser', value: 'Chrome, Firefox' },
  { label: 'AI', value: 'GitHub Copilot, Claude Code' },
];

export const usesCategories: readonly UsesCategory[] = [
  {
    id: 'hardware',
    title: 'Hardware',
    icon: 'lucide:cpu',
    items: [
      {
        name: 'Desktop PC',
        detail: 'AMD Ryzen 7 5800X, GeForce RTX 3070, 32 GB RAM. Where most of the work happens.',
      },
      { name: 'ASUS Zenbook 14 OLED', detail: 'The laptop, for working on the go.' },
    ],
  },
  {
    id: 'systems',
    title: 'Operating systems',
    icon: 'lucide:monitor',
    items: [
      { name: 'Windows 11', detail: 'On both machines, next to Debian.' },
      { name: 'Debian 13 (trixie)', detail: 'On both machines, with the GNOME desktop.' },
    ],
  },
  {
    id: 'terminal',
    title: 'Terminal and shell',
    icon: 'lucide:square-terminal',
    items: [
      { name: 'PowerShell', detail: 'On Windows.' },
      { name: 'Bash', detail: 'On Debian.' },
      { name: 'Git', detail: 'On the command line and in the IDEs.' },
    ],
  },
  {
    id: 'editors',
    title: 'Editors and IDEs',
    icon: 'lucide:code-xml',
    items: [
      { name: 'WebStorm', detail: 'JavaScript and TypeScript.' },
      { name: 'PyCharm', detail: 'Python and machine learning.' },
      { name: 'CLion', detail: 'C and C++.' },
    ],
  },
  {
    id: 'browsers',
    title: 'Browsers',
    icon: 'lucide:globe',
    items: [
      { name: 'Chrome', detail: 'The main browser.' },
      { name: 'Firefox', detail: 'On Debian.' },
    ],
  },
  {
    id: 'ai',
    title: 'AI tools',
    icon: 'lucide:sparkles',
    items: [
      { name: 'GitHub Copilot', detail: 'Code assistance while writing.' },
      {
        name: 'Claude Code',
        detail: 'Planning, coding help, debugging, reviews and documentation.',
      },
    ],
  },
];
