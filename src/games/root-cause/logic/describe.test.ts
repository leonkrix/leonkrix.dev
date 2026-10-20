import { describe, expect, it } from 'vitest';

import { skins } from '../data/skins';
import { skinWords } from '../data/words';
import { describeClue } from './describe';
import { ANN, BEN, CLEO, kinds, layout, people } from './fixtures';
import { type Clue } from './types';

/**
 * The fixture has two rooms of different types (so each type is "the" one), two chairs, one table,
 * two developers, one designer and one admin.
 */
const context = {
  skin: skins['case-file'],
  words: skinWords['case-file'],
  people,
  layout,
  kinds,
};

const say = (clue: Clue): string => describeClue(clue, context);

describe('a thing that there is only one of is "the", else "a"', () => {
  it('speaks of the only room of a kind, the only object of a kind and the only person with a role', () => {
    expect(say({ type: 'inRoomType', person: ANN, roomType: 'open-office' })).toBe(
      'Ann is in the open office.',
    );
    expect(say({ type: 'notInRoomType', person: BEN, roomType: 'server-room' })).toBe(
      'Ben is not in the server room.',
    );
    expect(say({ type: 'nextToKind', person: ANN, kind: 'table' })).toBe(
      'Ann is next to the table.',
    );
    expect(say({ type: 'roomHasKind', person: BEN, kind: 'table', has: false })).toBe(
      'Ben is in a room without the table.',
    );
    expect(say({ type: 'noRoleNextToKind', role: 'designer', kind: 'table' })).toBe(
      'The designer is not next to the table.',
    );
  });

  it('says "the room with" an object there is only one of, as only one room can have it', () => {
    expect(say({ type: 'roomHasKind', person: ANN, kind: 'table', has: true })).toBe(
      'Ann is in the room with the table.',
    );
    expect(say({ type: 'roomHasKind', person: ANN, kind: 'chair', has: true })).toBe(
      'Ann is in a room with a chair.',
    );
  });

  it('keeps "a" and the plural when there are several', () => {
    expect(say({ type: 'nextToKind', person: ANN, kind: 'chair' })).toBe('Ann is next to a chair.');
    expect(say({ type: 'roomHasKind', person: BEN, kind: 'chair', has: false })).toBe(
      'Ben is in a room without chairs.',
    );
    expect(say({ type: 'noRoleNextToKind', role: 'developer', kind: 'chair' })).toBe(
      'No developer is next to a chair.',
    );
  });

  it('names the only person with a role in a clue about the people in a room', () => {
    expect(
      say({ type: 'roomRole', person: ANN, role: 'designer', counting: 'atLeast', n: 1 }),
    ).toBe('Ann is in the room with the designer.');
    expect(say({ type: 'roomRole', person: ANN, role: 'designer', counting: 'none', n: 0 })).toBe(
      'Ann is in a room without the designer.',
    );
  });
});

describe('the newer clues', () => {
  it('says a corner of the room, of a given room, and a numbered row or column', () => {
    expect(say({ type: 'roomCorner', person: ANN })).toBe('Ann is in a corner of their room.');
    expect(say({ type: 'cornerOfRoom', person: ANN, room: 1 })).toBe(
      'Ann is in a corner of the server room.',
    );
    expect(say({ type: 'rowCol', person: BEN, axis: 'col', index: 2 })).toBe(
      'Ben is in the third column.',
    );
    expect(say({ type: 'rowCol', person: BEN, axis: 'row', index: 1 })).toBe(
      'Ben is in the second row.',
    );
  });

  it('says nobody when a room is to have no people, not "exactly 0"', () => {
    expect(say({ type: 'roomCount', room: 0, n: 0 })).toBe('Nobody is in the open office.');
    expect(say({ type: 'roomCount', room: 0, n: 2 })).toBe(
      'Exactly 2 people are in the open office.',
    );
  });

  it('joins two parts without saying "is" twice', () => {
    const parts = [
      { type: 'roomCorner', person: ANN },
      { type: 'nextToWall', person: ANN },
    ] as const;
    expect(say({ type: 'and', person: ANN, parts })).toBe(
      'Ann is in a corner of their room and next to a wall.',
    );
    expect(say({ type: 'or', person: ANN, parts })).toBe(
      'Ann is either in a corner of their room or next to a wall.',
    );
    // Parts that do not both start with "is" keep their own verbs
    expect(
      say({
        type: 'or',
        person: CLEO,
        parts: [
          { type: 'onKind', person: CLEO, kind: 'chair' },
          { type: 'alone', person: CLEO },
        ],
      }),
    ).toBe('Cleo either sits on a chair or is alone in the room.');
  });

  it('says the row and the column of an object in a room, and nothing about the cell', () => {
    expect(
      say({ type: 'kindInLine', person: BEN, kind: 'chair', axis: 'row', where: 'same' }),
    ).toBe('Ben is in the same row as a chair in the same room.');
    expect(
      say({ type: 'kindInLine', person: BEN, kind: 'chair', axis: 'col', where: 'other' }),
    ).toBe('Ben is in the same column as a chair in another room.');
  });
});

describe('a count that is every one of them is said that way', () => {
  // Two developers (Ann is one) and one designer, one admin
  it('says "both" instead of "at least 2" when there are only two', () => {
    const both = say({
      type: 'roomRole',
      person: BEN,
      role: 'developer',
      counting: 'atLeast',
      n: 2,
    });
    expect(both).toBe('Ben is in a room with both developers.');
    expect(both).not.toContain('at least');
  });

  it('says "the other" for the one other person with your own role', () => {
    expect(
      say({ type: 'roomRole', person: ANN, role: 'developer', counting: 'atLeast', n: 1 }),
    ).toBe('Ann is in a room with the other developer.');
  });

  it('keeps "at least" when there are more of them than the number', () => {
    // Only two developers exist, so "at least 1" of them is a real choice for somebody else
    expect(
      say({ type: 'roomRole', person: BEN, role: 'developer', counting: 'atLeast', n: 1 }),
    ).toBe('Ben is in a room with at least one developer.');
  });

  it('says that a diagonal neighbour touches at a corner', () => {
    expect(say({ type: 'diagonal', person: ANN, other: BEN })).toBe(
      'Ann is diagonally next to Ben, touching at a corner.',
    );
  });
});
