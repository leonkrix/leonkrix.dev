import { describe, expect, it } from 'vitest';

import { createRandom } from '../../shared/random';
import { randomStory } from '../data/random-stories';
import { skins } from '../data/skins';
import { toLevel } from '../pool';
import { problemsOf, tierOf } from './generator';
import { rate } from './propagation';
import {
  chooseJob,
  jobFromQuery,
  RANDOM_SIZES,
  runJob,
  shareQuery,
  sizesFor,
  typicalMilliseconds,
} from './random-level';

describe('choosing a random level', () => {
  it('keeps to the wishes of the player, and chooses the rest by chance', () => {
    const job = chooseJob({ tier: 'medium', size: 6, skin: 'any' }, createRandom('a'), 'a');
    expect(job.tier).toBe('medium');
    expect(job.size).toBe(6);
    expect(skins[job.skin].victimRoles).toContain(job.victimRole);

    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const any = chooseJob(
        { tier: 'any', size: 'any', skin: 'any' },
        createRandom(seed),
        String(seed),
      );
      const [low, high] = RANDOM_SIZES[any.tier];
      expect(any.size).toBeGreaterThanOrEqual(low);
      expect(any.size).toBeLessThanOrEqual(high);
      seen.add(`${any.tier}-${any.skin}`);
    }
    expect(seen.size).toBe(6);
  });

  it('makes the look the player asked for, and any look by chance', () => {
    for (const skin of ['case-file', 'outage'] as const) {
      for (let seed = 0; seed < 20; seed += 1) {
        const job = chooseJob({ tier: 'any', size: 'any', skin }, createRandom(seed), String(seed));
        expect(job.skin).toBe(skin);
        expect(skins[skin].victimRoles).toContain(job.victimRole);
      }
    }
  });

  it('ignores a size that does not exist for the tier', () => {
    const job = chooseJob({ tier: 'easy', size: 9, skin: 'any' }, createRandom('b'), 'b');
    expect(job.size).toBeLessThanOrEqual(RANDOM_SIZES.easy[1]);
  });

  it('offers only sizes that can be made in reasonable time, and knows how long they take', () => {
    expect(sizesFor('easy')).toEqual([4, 5, 6, 7]);
    expect(sizesFor('any')).toEqual([4, 5, 6, 7, 8, 9]);
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (const size of sizesFor(tier)) {
        expect(typicalMilliseconds(tier, size), `${tier} ${String(size)}`).toBeGreaterThan(0);
        // More threads are faster, but not in proportion
        expect(typicalMilliseconds(tier, size, 4)).toBeLessThan(typicalMilliseconds(tier, size, 1));
        expect(typicalMilliseconds(tier, size, 4) * 4).toBeGreaterThanOrEqual(
          typicalMilliseconds(tier, size, 1) - 4,
        );
      }
    }
  });
});

describe('making a level for a job', () => {
  it('makes a verified level of the wanted tier and victim, and the seed makes it again', () => {
    const job = chooseJob(
      { tier: 'medium', size: 5, skin: 'any' },
      createRandom('job'),
      'job-seed',
    );
    const record = runJob(job);
    const level = toLevel(record);
    expect(record.size).toBe(5);
    expect(record.tier).toBe('medium');
    expect(record.people.at(-1)?.role).toBe(job.victimRole);
    expect(problemsOf(level)).toEqual([]);
    expect(tierOf(rate(level))).toBe('medium');
    // The seed in the record is enough to make the very same level again
    const again = runJob({ ...job, seed: record.seed });
    expect(again.layout).toEqual(record.layout);
    expect(again.clues).toEqual(record.clues);
  });
});

describe('the stories of random levels', () => {
  it('never name a room, never say the culprit was alone, and are the same for the same seed', () => {
    const rooms =
      /\b(office|meeting room|break room|server room|lab|archive|reception|corridor|network closet|closet|data hall|hall|ups room|cabling room|edge site|cooling room)\b/i;
    for (let seed = 0; seed < 60; seed += 1) {
      for (const [skin, victim] of [
        ['case-file', { name: 'Mara', role: seed % 2 === 0 ? 'founder' : 'developer' }],
        ['outage', { name: 'db-01', role: 'database' }],
      ] as const) {
        const { title, story } = randomStory(skin, String(seed), victim);
        expect(`${title} ${story}`).not.toMatch(rooms);
        expect(story).not.toMatch(/\balone\b/i);
        expect(story).not.toContain('{');
        // A device is named as it is written (db-01), a sentence about a role starts with a capital
        if (skin === 'outage') {
          expect(story).toContain(victim.name);
        } else {
          expect(story).toMatch(/^[A-Z]/);
        }
        expect(randomStory(skin, String(seed), victim)).toEqual({ title, story });
      }
    }
  });

  it('name the victim by its role, or its device name', () => {
    expect(randomStory('outage', 'x', { name: 'fw-01', role: 'firewall' }).story).toContain(
      'fw-01',
    );
    expect(
      randomStory('case-file', 'x', { name: 'Mara', role: 'cto' }).story.toLowerCase(),
    ).toContain('the cto');
  });
});

describe('the address of a random level', () => {
  const job = chooseJob({ tier: 'easy', size: 5, skin: 'any' }, createRandom('link'), 'link-seed');

  it('is read again as the very same job and level', () => {
    const record = runJob(job);
    const query = shareQuery(record);
    expect(query).toMatch(/^\?level=random&seed=/);
    const again = jobFromQuery(query);
    expect(again).toEqual({
      skin: record.skin,
      tier: record.tier,
      size: record.size,
      victimRole: record.people.at(-1)?.role,
      seed: record.seed,
    });
    // One thread with the seed of the link makes the level of the link
    const same = runJob(again ?? job);
    expect(same.layout).toEqual(record.layout);
    expect(same.clues).toEqual(record.clues);
    expect(same.solution).toEqual(record.solution);
  });

  it('ignores addresses that are not a valid random level', () => {
    const ok = '?level=random&seed=abc-1&tier=easy&size=5&skin=outage&victim=server';
    expect(jobFromQuery(ok)).toBeDefined();
    const bad = [
      '',
      '?level=easy-1',
      '?level=random',
      '?level=random&seed=abc-1&tier=easy&size=5&skin=outage&victim=founder',
      '?level=random&seed=ABC&tier=easy&size=5&skin=outage&victim=server',
      '?level=random&seed=abc-1&tier=easy&size=3&skin=outage&victim=server',
      '?level=random&seed=abc-1&tier=easy&size=10&skin=outage&victim=server',
      '?level=random&seed=abc-1&tier=hard-ish&size=5&skin=outage&victim=server',
      '?level=random&seed=abc-1&tier=easy&size=5&skin=other&victim=server',
      `?level=random&seed=${'a'.repeat(61)}&tier=easy&size=5&skin=outage&victim=server`,
      '?level=random&seed=a%20b&tier=easy&size=5&skin=outage&victim=server',
    ];
    for (const query of bad) {
      expect(jobFromQuery(query), query).toBeUndefined();
    }
  });
});
