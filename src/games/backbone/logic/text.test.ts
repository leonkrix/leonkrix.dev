import { describe, expect, it } from 'vitest';

import { shortestPathPlan } from './baselines';
import { diamond, randomLevel } from './fixtures';
import { floodDirections, floodLinks } from './flood';
import { indexLevel } from './graph';
import { evaluate } from './simulate';
import {
  describeBusiest,
  describeSwitch,
  eventsAt,
  eventTexts,
  forecastOf,
  riskyLinks,
  summarize,
} from './text';

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

describe('the forecast', () => {
  it('writes out every situation with the minutes of its events, counted from 1', () => {
    const index = indexLevel(randomLevel(5));
    // The cables that lose packets all the time come first, as "On every day"
    const forecast = forecastOf(index).filter((entry) => entry.id !== 'always');
    expect(forecast.map((situation) => situation.name)).toEqual(['Calm', 'Rush', 'Attack']);
    expect(forecast[0]?.items).toEqual([]);
    // The cable is cut from index 2 to 6 (minutes 3 to 6), the burst from 3 to 5 (minutes 4 and 5)
    expect(forecast[1]?.items.map((item) => [item.kind, item.minutes])).toEqual([
      ['down', 'Minutes 3–6'],
      ['burst', 'Minutes 4–5'],
    ]);
    expect(forecast[2]?.items[0]?.text).toMatch(
      / floods .* with 4 per minute. It goes the fastest way/,
    );
  });

  it('marks the cables that something happens to, a cut before loss before slowness', () => {
    const level = randomLevel(5);
    const risks = riskyLinks(level);
    const cut = level.situations[1]?.events.find((event) => event.kind === 'down');
    expect(cut?.kind === 'down' ? risks.get(cut.link) : undefined).toBe('down');
    // The cut wins over the loss of the same cable and over a flood
    expect([...risks.values()].filter((kind) => kind === 'down')).toHaveLength(1);
  });
});

describe('what a cable loses all the time and where a flood goes', () => {
  it('lists a cable with a loss of its own in the forecast, as always', () => {
    const level = diamond({
      links: [
        { id: 'AB', a: 'A', b: 'B', capacity: 10, delay: 1, loss: 0.1 },
        { id: 'BD', a: 'B', b: 'D', capacity: 10, delay: 1, loss: 0 },
        { id: 'AC', a: 'A', b: 'C', capacity: 10, delay: 2, loss: 0 },
        { id: 'CD', a: 'C', b: 'D', capacity: 10, delay: 2, loss: 0 },
      ],
    });
    const forecast = forecastOf(indexLevel(level));
    expect(forecast[0]?.id).toBe('always');
    expect(forecast[0]?.items[0]?.text).toBe('A – B loses 10 % of its packets');
    expect(forecast[0]?.items[0]?.minutes).toBe('Always');
    expect(riskyLinks(level).get('AB')).toBe('lossy');
  });

  it('says over which nodes a flood goes, and marks those cables', () => {
    const level = randomLevel(5);
    const index = indexLevel(level);
    const attack = forecastOf(index).find((entry) => entry.name === 'Attack');
    expect(attack?.items[0]?.text).toMatch(/It goes the fastest way: N\d.* → N\d/);
    const flood = level.situations[2]?.events[0];
    expect(flood?.kind).toBe('flood');
    if (flood?.kind === 'flood') {
      const marked = [...riskyLinks(level)].filter(([, kind]) => kind === 'flood');
      expect(marked.map(([id]) => id).sort()).toEqual(
        [...floodLinks(index, flood, () => true)].sort(),
      );
    }
  });

  it('runs the marks of a flood the way the flood goes, cable after cable', () => {
    const level = randomLevel(5);
    const index = indexLevel(level);
    const flood = level.situations[2]?.events[0];
    if (flood?.kind !== 'flood') {
      throw new Error('the random level has a flood');
    }
    const directions = floodDirections(index, [flood], 2, () => true);
    const links = floodLinks(index, flood, () => true);
    let at = flood.source;
    for (const id of links) {
      expect(directions.get(id), id).toBe(at);
      const link = index.linkById.get(id);
      at = link?.a === at ? link.b : (link?.a ?? '');
    }
    expect(at).toBe(flood.target);
  });
});
