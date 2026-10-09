import { describe, expect, it } from 'vitest';

import { techCategories, techCategoryLabels } from './tech-term';

describe('tech categories', () => {
  it('has a unique, non-empty label for every category and no extra labels', () => {
    expect(Object.keys(techCategoryLabels).sort()).toEqual([...techCategories].sort());
    const labels = Object.values(techCategoryLabels);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) {
      expect(label.trim()).not.toBe('');
    }
  });
});
