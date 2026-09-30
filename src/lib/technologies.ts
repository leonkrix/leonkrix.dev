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

  // Tooling
  git: { label: 'Git', icon: 'simple-icons:git' },
  docker: { label: 'Docker', icon: 'simple-icons:docker' },
  cicd: { label: 'CI/CD', icon: 'simple-icons:githubactions' },
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
    items: ['react', 'nodejs', 'express', 'mongodb', 'astro', 'tailwindcss', 'android'],
  },
  {
    title: 'Machine Learning',
    items: ['pytorch', 'raytune', 'deeplearning', 'gnn', 'rl'],
  },
  {
    title: 'Tooling',
    items: ['git', 'docker', 'cicd'],
  },
];
