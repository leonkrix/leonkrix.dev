export interface Technology {
  label: string;
  /** Icon in the form "<set>:<name>", see Icon.astro */
  icon: string;
}

/**
 * All technologies and topics used across the site (About, Projects). Reference them by id.
 * Icons come from the local lucide and simple-icons sets (brand icons where one exists).
 */
export const technologies = {
  // Languages
  typescript: { label: 'TypeScript', icon: 'simple-icons:typescript' },
  javascript: { label: 'JavaScript', icon: 'simple-icons:javascript' },
  python: { label: 'Python', icon: 'simple-icons:python' },
  java: { label: 'Java', icon: 'simple-icons:openjdk' },
  c: { label: 'C', icon: 'simple-icons:c' },
  cpp: { label: 'C++', icon: 'simple-icons:cplusplus' },
  sql: { label: 'SQL', icon: 'lucide:database' },
  shell: { label: 'Shell', icon: 'simple-icons:gnubash' },

  // Web and mobile
  react: { label: 'React', icon: 'simple-icons:react' },
  nodejs: { label: 'Node.js', icon: 'simple-icons:nodedotjs' },
  express: { label: 'Express', icon: 'simple-icons:express' },
  fastapi: { label: 'FastAPI', icon: 'simple-icons:fastapi' },
  restapis: { label: 'REST APIs', icon: 'lucide:webhook' },
  stripe: { label: 'Stripe', icon: 'simple-icons:stripe' },
  mongodb: { label: 'MongoDB', icon: 'simple-icons:mongodb' },
  astro: { label: 'Astro', icon: 'simple-icons:astro' },
  tailwindcss: { label: 'Tailwind CSS', icon: 'simple-icons:tailwindcss' },
  android: { label: 'Android', icon: 'simple-icons:android' },

  // Machine learning
  pytorch: { label: 'PyTorch', icon: 'simple-icons:pytorch' },
  raytune: { label: 'Ray Tune', icon: 'simple-icons:ray' },
  deeplearning: { label: 'Deep Learning', icon: 'lucide:brain-circuit' },
  gnn: { label: 'Graph Neural Networks', icon: 'lucide:network' },
  rl: { label: 'Reinforcement Learning', icon: 'lucide:bot' },
  tensorboard: { label: 'TensorBoard', icon: 'lucide:chart-line' },
  numpypandas: { label: 'NumPy & pandas', icon: 'simple-icons:numpy' },

  // Networking
  networking: { label: 'Computer Networks', icon: 'lucide:waypoints' },
  networkprotocols: { label: 'Network Protocols', icon: 'lucide:arrow-left-right' },
  networkcoding: { label: 'Network Coding', icon: 'lucide:blend' },
  ns3: { label: 'ns-3', icon: 'lucide:radio-tower' },
  wireshark: { label: 'Wireshark', icon: 'simple-icons:wireshark' },

  // Tooling
  git: { label: 'Git', icon: 'simple-icons:git' },
  linux: { label: 'Linux / Unix', icon: 'simple-icons:linux' },
  docker: { label: 'Docker', icon: 'simple-icons:docker' },
  cicd: { label: 'CI/CD', icon: 'simple-icons:githubactions' },
  cloudflare: { label: 'Cloudflare', icon: 'simple-icons:cloudflare' },
  profiling: { label: 'Profiling & Debugging', icon: 'lucide:activity' },
  jetbrains: { label: 'JetBrains IDEs', icon: 'simple-icons:jetbrains' },
  aiassisted: { label: 'AI-assisted development', icon: 'lucide:sparkles' },

  // Code quality
  eslint: { label: 'ESLint', icon: 'simple-icons:eslint' },
  prettier: { label: 'Prettier', icon: 'simple-icons:prettier' },
  vitest: { label: 'Vitest', icon: 'simple-icons:vitest' },
  playwright: { label: 'Playwright', icon: 'simple-icons:playwright' },
  axe: { label: 'axe-core', icon: 'lucide:accessibility' },
  lighthouse: { label: 'Lighthouse', icon: 'simple-icons:lighthouse' },
} as const satisfies Record<string, Technology>;

export type TechnologyId = keyof typeof technologies;

export interface TechnologyGroup {
  title: string;
  items: readonly TechnologyId[];
}

/** Grouping used in the About section. Every technology must appear in exactly one group. */
export const technologyGroups: readonly TechnologyGroup[] = [
  {
    title: 'Languages',
    items: ['typescript', 'javascript', 'python', 'java', 'c', 'cpp', 'sql', 'shell'],
  },
  {
    title: 'Web & Mobile',
    items: [
      'react',
      'nodejs',
      'express',
      'fastapi',
      'restapis',
      'stripe',
      'mongodb',
      'astro',
      'tailwindcss',
      'android',
    ],
  },
  {
    title: 'Machine Learning',
    items: ['pytorch', 'raytune', 'numpypandas', 'deeplearning', 'gnn', 'rl', 'tensorboard'],
  },
  {
    title: 'Networking',
    items: ['networking', 'networkprotocols', 'networkcoding', 'ns3', 'wireshark'],
  },
  {
    title: 'Tooling',
    items: ['git', 'linux', 'docker', 'cicd', 'cloudflare', 'profiling', 'jetbrains', 'aiassisted'],
  },
  {
    title: 'Code Quality',
    items: ['eslint', 'prettier', 'vitest', 'playwright', 'axe', 'lighthouse'],
  },
];
