import { describe, expect, it } from 'vitest';

import { allRules, diamond } from './fixtures';
import { indexLevel } from './graph';
import { flowOptions, THROTTLE_STEPS } from './options';
import type { Flow } from './types';

function flowOf(profile: Flow['profile'], id: string): Flow {
  return { id, name: id, profile, source: 'A', target: 'D', demand: 4 };
}

describe('the throttle steps', () => {
  it('are the whole tens from 100 down to 10 percent', () => {
    expect(THROTTLE_STEPS.map((step) => Math.round(step * 100))).toEqual([
      100, 90, 80, 70, 60, 50, 40, 30, 20, 10,
    ]);
  });

  it('are exactly what a slider in steps of ten percent can set', () => {
    // The slider hands over percent / 100 and the plan compares the number with ===
    for (let percent = 10; percent <= 100; percent += 10) {
      expect(THROTTLE_STEPS).toContain(percent / 100);
    }
  });

  it('are offered to a bulk flow and to no other kind of traffic', () => {
    const level = diamond({
      rules: allRules,
      flows: [flowOf('bulk', 'f1'), flowOf('web', 'f2')],
    });
    const index = indexLevel(level);
    const throttlesOf = (flow: Flow): number[] =>
      [...new Set(flowOptions(index, flow).map((option) => option.throttle))].sort((a, b) => b - a);
    expect(throttlesOf(flowOf('bulk', 'f1'))).toEqual([...THROTTLE_STEPS]);
    expect(throttlesOf(flowOf('web', 'f2'))).toEqual([1]);
  });
});
