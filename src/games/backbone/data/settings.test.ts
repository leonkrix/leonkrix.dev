import { describe, expect, it } from 'vitest';

import { settingNames } from './setting-names';
import { settings } from './settings';

describe('the settings', () => {
  it('have the same names in the short list and the long one', () => {
    for (const [id, setting] of Object.entries(settings)) {
      expect(settingNames[id as keyof typeof settingNames]).toBe(setting.name);
    }
    expect(Object.keys(settingNames).sort()).toEqual(Object.keys(settings).sort());
  });

  it('name every kind of node and every profile of flow with enough names for a level', () => {
    for (const setting of Object.values(settings)) {
      for (const names of Object.values(setting.flows)) {
        expect(names.length).toBeGreaterThanOrEqual(3);
      }
      for (const names of Object.values(setting.nodes)) {
        expect(new Set(names).size).toBe(names.length);
      }
    }
  });
});
