import { describe, expect, it } from 'vitest';

import { formatPeriod, projectSchema, sortProjects } from './projects';

const valid = {
  title: 'Example',
  kind: 'project',
  start: 2024,
  highlights: ['Did something'],
  technologies: ['typescript'],
  code: { status: 'none' },
};

describe('projectSchema', () => {
  it('accepts a valid project', () => {
    expect(projectSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a public project with a GitHub URL', () => {
    const project = { ...valid, code: { status: 'public', url: 'https://github.com/leonkrix/x' } };
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it('rejects a public project without or with a non-GitHub URL', () => {
    expect(projectSchema.safeParse({ ...valid, code: { status: 'public' } }).success).toBe(false);
    const other = { ...valid, code: { status: 'public', url: 'https://example.com/x' } };
    expect(projectSchema.safeParse(other).success).toBe(false);
  });

  it('does not allow a link on private or planned projects', () => {
    for (const status of ['none', 'planned']) {
      const project = { ...valid, code: { status, url: 'https://github.com/leonkrix/x' } };
      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(true);
      // The link is stripped, so it can never be rendered
      expect(result.data?.code).toEqual({ status });
    }
  });

  it('rejects unknown technologies, unknown kinds and empty highlights', () => {
    expect(projectSchema.safeParse({ ...valid, technologies: ['cobol'] }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, kind: 'hobby' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, highlights: [] }).success).toBe(false);
  });

  it('accepts an institution, a grade and key figures', () => {
    const project = {
      ...valid,
      institution: 'TUM',
      grade: '1.0',
      stats: [{ value: '−47%', label: 'mean delay' }],
    };
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it('rejects empty or too many key figures', () => {
    const stat = { value: '1', label: 'x' };
    expect(projectSchema.safeParse({ ...valid, stats: [] }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, stats: Array(5).fill(stat) }).success).toBe(false);
  });

  it('rejects an end year before the start year', () => {
    expect(projectSchema.safeParse({ ...valid, start: 2025, end: 2024 }).success).toBe(false);
  });
});

describe('formatPeriod', () => {
  it('shows a single year or a range', () => {
    expect(formatPeriod({ start: 2019 })).toBe('2019');
    expect(formatPeriod({ start: 2019, end: 2019 })).toBe('2019');
    expect(formatPeriod({ start: 2023, end: 2024 })).toBe('2023 – 2024');
  });
});

describe('sortProjects', () => {
  it('sorts newest first by end year, then start year, then title', () => {
    const sorted = sortProjects([
      { title: 'A old', start: 2019 },
      { title: 'B thesis', start: 2025, end: 2026 },
      { title: 'C site', start: 2026 },
      { title: 'D group', start: 2024, end: 2025 },
    ]);
    expect(sorted.map((project) => project.title)).toEqual([
      'C site',
      'B thesis',
      'D group',
      'A old',
    ]);
  });

  it('does not change the input array', () => {
    const input = [
      { title: 'old', start: 2019 },
      { title: 'new', start: 2026 },
    ];
    sortProjects(input);
    expect(input[0]?.title).toBe('old');
  });
});
