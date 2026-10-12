import { describe, expect, it } from 'vitest';

import { categories, conflicts } from './index';

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('the categories of Link Up', () => {
  it('are at least 150, each with 7 to 20 terms, and have unique ids', () => {
    expect(categories.length).toBeGreaterThanOrEqual(150);
    expect(new Set(categories.map((category) => category.id)).size).toBe(categories.length);
    for (const category of categories) {
      expect(category.terms.length, category.id).toBeGreaterThanOrEqual(7);
      expect(category.terms.length, category.id).toBeLessThanOrEqual(20);
      expect(category.id, category.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('are well filled: on average at least eleven terms, and plenty in total', () => {
    const total = categories.reduce((sum, category) => sum + category.terms.length, 0);
    expect(total).toBeGreaterThanOrEqual(1700);
    expect(total / categories.length).toBeGreaterThanOrEqual(11);
  });

  it('have a name and a description of at most 100 characters', () => {
    for (const category of categories) {
      expect(category.name.length, category.id).toBeGreaterThan(2);
      expect(category.description.length, category.id).toBeGreaterThan(10);
      expect(category.description.length, category.id).toBeLessThanOrEqual(100);
      expect(category.description, category.id).toMatch(/[.]$/);
    }
  });
});

describe('the terms of Link Up', () => {
  const terms = categories.flatMap((category) =>
    category.terms.map((term) => ({ ...term, category: category.id })),
  );

  it('are unique in the whole pool (a term has exactly one category)', () => {
    const names = terms.map((term) => term.name.toLowerCase());
    const doubles = names.filter((name, index) => names.indexOf(name) !== index);
    expect(doubles).toEqual([]);
  });

  it('fit on a tile: at most 18 characters, no line breaks, nothing at the edges', () => {
    for (const term of terms) {
      expect(term.name.length, term.name).toBeGreaterThan(0);
      expect(term.name.length, term.name).toBeLessThanOrEqual(18);
      expect(term.name, term.name).toBe(term.name.trim());
      expect(term.name, term.name).not.toMatch(/\n/);
    }
  });

  it('have a definition of at most 100 characters, one sentence, that does not name the term', () => {
    for (const term of terms) {
      expect(term.definition.length, term.name).toBeGreaterThan(10);
      expect(term.definition.length, term.name).toBeLessThanOrEqual(100);
      expect(term.definition, term.name).toMatch(/[.]$/);
      // Not the term as a whole word (a longer word that contains it, such as "headers", is fine)
      const whole = new RegExp(`(^|[^A-Za-z0-9])${escape(term.name)}($|[^A-Za-z0-9])`, 'i');
      expect(term.definition, `${term.name}: ${term.definition}`).not.toMatch(whole);
    }
  });
});

describe('the conflicts of Link Up', () => {
  it('only name categories that exist, and no pair twice', () => {
    const ids = new Set(categories.map((category) => category.id));
    const keys = new Set<string>();
    for (const [first, second] of conflicts) {
      expect(ids.has(first), first).toBe(true);
      expect(ids.has(second), second).toBe(true);
      expect(first).not.toBe(second);
      const key = [first, second].sort().join('|');
      expect(keys.has(key), key).toBe(false);
      keys.add(key);
    }
  });

  it('leave enough categories that can meet: every category has a partner for a puzzle', () => {
    const blocked = new Set(conflicts.map(([a, b]) => [a, b].sort().join('|')));
    for (const category of categories) {
      const partners = categories.filter(
        (other) =>
          other.id !== category.id && !blocked.has([category.id, other.id].sort().join('|')),
      );
      expect(partners.length, category.id).toBeGreaterThanOrEqual(3);
    }
  });
});
