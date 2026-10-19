import { describe, expect, it } from 'vitest';

import { shortestPathPlan } from './baselines';
import { diamond, randomLevel } from './fixtures';
import { indexLevel } from './graph';
import { evaluate } from './simulate';
import { describeBusiest, describeSwitch, eventsAt, eventTexts, summarize } from './text';

describe('the sentences of a step', () => {
  it('say what happens, with the kind of event next to it', () => {
    const level = randomLevel(5);
    const index = indexLevel(level);
    const rush = level.situations[1];
    const attack = level.situations[2];
    if (rush === undefined || attack === undefined) {
      throw new Error('the random level has three situations');
    }
    const burst = eventTexts(index, rush, 3);
    expect(burst.map((event) => event.kind)).toEqual(['down', 'burst']);
    expect(burst[0]?.text).toMatch(/ is cut$/);
    expect(burst[1]?.text).toMatch(/ sends 2 times as much$/);
    expect(eventTexts(index, attack, 2).map((event) => event.kind)).toEqual(['flood']);
    expect(eventTexts(index, attack, 0)).toEqual([]);
    expect(eventsAt(index, rush, 3)).toEqual(burst.map((event) => event.text));
  });
});

describe('the busiest cable in words', () => {
  it('names a plan that overloads a cable as the fault of the plan, and the situation', () => {
    const level = diamond({
      flows: [
        { id: 'f1', name: 'one', source: 'A', target: 'D', profile: 'web', demand: 8 },
        { id: 'f2', name: 'two', source: 'A', target: 'D', profile: 'web', demand: 8 },
      ],
    });
    const index = indexLevel(level);
    const summary = summarize(index, evaluate(index, shortestPathPlan(index)));
    const text = describeBusiest(index, summary);
    expect(text).toBe(
      'Your plan sends more through A – B than it can carry: 160 % of its capacity (in "Calm").',
    );
    expect(summary.busiest?.situation).toBe('Calm');
  });

  it('says that nothing was overloaded when nothing was', () => {
    const level = diamond();
    const index = indexLevel(level);
    const summary = summarize(index, evaluate(index, shortestPathPlan(index)));
    expect(describeBusiest(index, summary)).toBe('No cable was overloaded.');
  });
});

describe('what changes at a step', () => {
  it('names the event that starts and the one that ends, for a change of path', () => {
    const index = indexLevel(randomLevel(5));
    // The random level cuts a cable from step 2 to 6 and bursts a flow from 3 to 5
    expect(describeSwitch(index, 2)).toMatch(/ is cut$/);
    expect(describeSwitch(index, 3)).toMatch(/ sends 2 times as much$/);
    expect(describeSwitch(index, 5)).toMatch(/ is back to normal$/);
    expect(describeSwitch(index, 6)).toBe('N5 – N1 is back, the flood stops');
    // Nothing starts or ends at step 4
    expect(describeSwitch(index, 4)).toBe('');
  });
});
