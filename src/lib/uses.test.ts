import { describe, expect, it } from 'vitest';

import { usesCategories, usesSummary, usesUpdated } from './uses';

describe('uses content', () => {
  it('has a month of the last change', () => {
    expect(usesUpdated).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it('has categories with unique ids and titles, each with an icon and some items', () => {
    expect(new Set(usesCategories.map((category) => category.id)).size).toBe(usesCategories.length);
    expect(new Set(usesCategories.map((category) => category.title)).size).toBe(
      usesCategories.length,
    );
    for (const category of usesCategories) {
      expect(category.icon, category.id).toMatch(/^(lucide|simple-icons):[a-z0-9-]+$/);
      expect(category.items.length, category.id).toBeGreaterThan(0);
    }
  });

  it('names every item once and keeps the lines short', () => {
    const names = usesCategories.flatMap((category) => category.items.map((item) => item.name));
    expect(new Set(names).size).toBe(names.length);
    for (const category of usesCategories) {
      for (const item of category.items) {
        expect(item.name.trim(), category.id).not.toBe('');
        expect((item.detail ?? '').length, item.name).toBeLessThanOrEqual(100);
      }
    }
  });

  it('has no more terminal lines than the animation has places for (12)', () => {
    expect(usesSummary.length).toBeLessThanOrEqual(12);
  });

  it('has a terminal block whose labels are unique and whose values are short enough for a phone', () => {
    expect(new Set(usesSummary.map((line) => line.label)).size).toBe(usesSummary.length);
    for (const line of usesSummary) {
      // A line is "label value" in a monospace font on a narrow screen, so it must be able to wrap
      // or fit: keep values short
      expect(line.value.length, line.label).toBeLessThanOrEqual(40);
    }
  });
});
