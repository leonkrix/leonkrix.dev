import { type Noun, type SkinWords } from '../data/words';
import { type Skin } from './skin';
import {
  type Clue,
  type Counting,
  type Direction,
  type Layout,
  type Line,
  type NeutralClue,
  type Person,
  type PersonClue,
  type RoomRelation,
} from './types';

/** Everything the texts of the clues need to know about a level and its skin */
export interface DescribeContext {
  skin: Skin;
  words: SkinWords;
  people: readonly Person[];
  layout: Layout;
  kinds: Readonly<Record<string, { occupiable: boolean }>>;
}

const DIRECTION_TEXT: Readonly<Record<Direction, string>> = {
  north: 'north',
  south: 'south',
  east: 'east',
  west: 'west',
  northeast: 'north-east',
  northwest: 'north-west',
  southeast: 'south-east',
  southwest: 'south-west',
};

const LINE_TEXT: Readonly<Record<Line, string>> = {
  firstRow: 'the first row',
  lastRow: 'the last row',
  firstCol: 'the first column',
  lastCol: 'the last column',
  middleRow: 'the middle row',
  middleCol: 'the middle column',
};

/** "a" or "an" in front of a word, as it is spoken ("a UPS room", "an open office") */
export function article(word: string): string {
  return /^[aeio]/i.test(word) ? 'an' : 'a';
}

function number(n: number): string {
  return n === 1 ? 'one' : String(n);
}

function noun(table: Readonly<Record<string, Noun>>, id: string): Noun {
  return table[id] ?? { one: `a ${id}`, plural: `${id}s` };
}

/** A noun without its article: "developer" */
function bare(value: Noun): string {
  return value.one.replace(/^(an?|the) /, '');
}

/** A room type in running text: "server room", but "UPS room" keeps its capitals */
function typeText(skin: Skin, id: string): string {
  const name = skin.roomTypes.find((type) => type.id === id)?.name ?? id;
  return /^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

export function roomText(layout: Layout, room: number): string {
  const name = layout.rooms[room]?.name ?? `room ${String(room + 1)}`;
  // A numbered room is a name of its own ("Server room 2"), the others are common nouns after
  // "the" ("the archive"), except an acronym such as "UPS room"
  const common = /^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
  return /\d$/.test(name) ? name : `the ${common}`;
}

function listOf(items: readonly string[]): string {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1) ?? ''}`;
}

/** The kinds of objects that people can be on and that are on this map: a clue names no other */
function occupiableKinds(context: DescribeContext): string {
  const present = new Set(context.layout.objects.map((object) => object.kind));
  const names = Object.entries(context.kinds)
    .filter(([id, info]) => info.occupiable && present.has(id))
    .map(([id]) => noun(context.words.kinds, id).one);
  return listOf(names);
}

function countText(counting: Counting, n: number): string {
  return `${counting === 'atLeast' ? 'at least' : 'exactly'} ${number(n)}`;
}

function relationText(where: RoomRelation | 'any'): string {
  return where === 'same' ? ' in the same room' : where === 'other' ? ' in another room' : '';
}

/**
 * The part of a sentence that follows the name of a suspect: "is next to a plant". The victim
 * is never the subject of a clue.
 */
function predicate(clue: PersonClue, context: DescribeContext): string {
  const { skin, words, people, layout } = context;
  const name = (person: number): string => people[person]?.name ?? '?';
  const kind = (id: string): Noun => noun(words.kinds, id);

  switch (clue.type) {
    case 'inRoom':
      return `is in ${roomText(layout, clue.room)}`;
    case 'notInRoom':
      return `is not in ${roomText(layout, clue.room)}`;
    case 'inRoomType': {
      const text = typeText(skin, clue.roomType);
      return `is in ${article(text)} ${text}`;
    }
    case 'notInRoomType': {
      const text = typeText(skin, clue.roomType);
      return `is not in ${article(text)} ${text}`;
    }
    case 'sameRoom':
      return `is in the same room as ${name(clue.other)}`;
    case 'notSameRoom':
      return `is not in the same room as ${name(clue.other)}`;
    case 'roomHasWindow':
      return clue.has ? 'is in a room with a window' : 'is in a room without a window';
    case 'roomHasKind':
      return clue.has
        ? `is in a room with ${kind(clue.kind).one}`
        : `is in a room without ${kind(clue.kind).plural}`;
    case 'roomSize':
      return `is in the ${clue.which} room`;
    case 'onKind':
      return `${kind(clue.kind).on ?? 'is on'} ${kind(clue.kind).one}`;
    case 'notOnKind':
      return `${kind(clue.kind).notOn ?? 'is not on'} ${kind(clue.kind).one}`;
    case 'onFurniture':
      return `is on ${occupiableKinds(context)}`;
    case 'onFloor':
      return 'is on the bare floor, not on an object';
    case 'soleOnKind':
      return `is the only ${words.person} on ${kind(clue.kind).one}`;
    case 'nextToKind':
      return `is next to ${kind(clue.kind).one}`;
    case 'notNextToKind':
      return `is not next to ${kind(clue.kind).one}`;
    case 'windowFront':
      return 'is in front of a window';
    case 'kindInLine':
      return `is in the same ${clue.axis === 'row' ? 'row' : 'column'} as ${kind(clue.kind).one} in ${clue.where === 'same' ? 'the same room' : 'another room'}`;
    case 'relativeToKind':
      return `is ${DIRECTION_TEXT[clue.direction]} of ${kind(clue.kind).one}${relationText(clue.where)}`;
    case 'corner':
      return `is in a corner of the ${words.place}`;
    case 'line':
      return `is in ${LINE_TEXT[clue.line]}`;
    case 'nextToWall':
      return 'is next to a wall';
    case 'notNextToWall':
      return 'is not next to a wall';
    case 'alone':
      return 'is alone in the room';
    case 'roomMates':
      return `shares a room with ${countText(clue.counting, clue.n)} ${clue.n === 1 ? `other ${words.person}` : `other ${words.people}`}`;
    case 'roomRole': {
      const role = noun(words.roles, clue.role);
      const own = people[clue.person]?.role === clue.role;
      const others = own ? `other ${role.plural}` : role.plural;
      if (clue.counting === 'none') {
        return `is in a room with no ${others}`;
      }
      const single = own ? `other ${bare(role)}` : bare(role);
      return `is in a room with ${countText(clue.counting, clue.n)} ${clue.n === 1 ? single : others}`;
    }
    case 'direction':
      return clue.mode === 'adjacent'
        ? `is exactly one step ${DIRECTION_TEXT[clue.direction]} of ${name(clue.other)}`
        : `is somewhere ${DIRECTION_TEXT[clue.direction]} of ${name(clue.other)}`;
    case 'diagonal':
      return `is diagonally next to ${name(clue.other)}`;
    case 'between':
      return `is in a ${clue.axis === 'row' ? 'row' : 'column'} between those of ${name(clue.other)} and ${name(clue.third)}`;
    case 'distance':
      return `is exactly ${number(clue.distance)} ${clue.distance === 1 ? 'step' : 'steps'} away from ${name(clue.other)} (rows plus columns)`;
  }
}

function neutralText(clue: NeutralClue, context: DescribeContext): string {
  const { words, people, layout } = context;
  const kind = (id: string): Noun => noun(words.kinds, id);

  switch (clue.type) {
    case 'roomEmpty':
      return `${words.nobody} is in ${roomText(layout, clue.room)}.`;
    case 'roomCount':
      return clue.n === 1
        ? `Exactly one ${words.person} is in ${roomText(layout, clue.room)}.`
        : `Exactly ${number(clue.n)} ${words.people} are in ${roomText(layout, clue.room)}.`;
    case 'emptyRooms':
      if (clue.n === 0) {
        return 'No room is empty.';
      }
      return clue.n === 1
        ? 'Exactly one room is empty.'
        : `Exactly ${number(clue.n)} rooms are empty.`;
    case 'kindCount':
      if (clue.counting === 'exactly' && clue.n === 0) {
        return `${words.nobody} is on ${kind(clue.kind).one}.`;
      }
      return `${clue.counting === 'atLeast' ? 'At least' : 'Exactly'} ${number(clue.n)} ${clue.n === 1 ? `${words.person} is` : `${words.people} are`} on ${clue.n === 1 ? kind(clue.kind).one : kind(clue.kind).plural}.`;
    case 'kindFree':
      if (clue.n === 0) {
        return `Every one of the ${kind(clue.kind).plural} has a ${words.person} on it.`;
      }
      return clue.n === 1
        ? `Exactly one of the ${kind(clue.kind).plural} has ${words.nobody.toLowerCase()} on it.`
        : `Exactly ${number(clue.n)} of the ${kind(clue.kind).plural} have ${words.nobody.toLowerCase()} on them.`;
    case 'distinctRoomCounts':
      return `Every room holds a different number of ${words.people}.`;
    case 'everyRoomKind':
      if (clue.n === 0) {
        return `${words.nobody} is on ${kind(clue.kind).one} in any room.`;
      }
      return `Every room has exactly ${number(clue.n)} ${clue.n === 1 ? words.person : words.people} on ${clue.n === 1 ? kind(clue.kind).one : kind(clue.kind).plural}.`;
    case 'noRoleNextToKind':
      return `No ${bare(noun(words.roles, clue.role))} is next to ${kind(clue.kind).one}.`;
    case 'rolesApart':
      return `No two ${words.people} ${words.sameRole} share a room.`;
    case 'separate': {
      const names = clue.persons.map((person) => people[person]?.name ?? '?');
      return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''} are all in different rooms.`;
    }
    case 'cornerCount':
      if (clue.n === 0) {
        return `${words.nobody} is in a corner of the ${words.place}.`;
      }
      return `Exactly ${number(clue.n)} ${clue.n === 1 ? `${words.person} is` : `${words.people} are`} in a corner of the ${words.place}.`;
  }
}

/** The text of a clue, as a sentence with a full stop. */
export function describeClue(clue: Clue, context: DescribeContext): string {
  switch (clue.type) {
    case 'and':
    case 'or': {
      const name = context.people[clue.person]?.name ?? '?';
      const [first, second] = clue.parts.map((part) => predicate(part, context));
      return clue.type === 'and'
        ? `${name} ${first ?? ''} and ${second ?? ''}.`
        : `${name} either ${first ?? ''} or ${second ?? ''}.`;
    }
    case 'roomEmpty':
    case 'roomCount':
    case 'emptyRooms':
    case 'kindCount':
    case 'kindFree':
    case 'distinctRoomCounts':
    case 'everyRoomKind':
    case 'noRoleNextToKind':
    case 'rolesApart':
    case 'separate':
    case 'cornerCount':
      return neutralText(clue, context);
    default:
      return `${context.people[clue.person]?.name ?? '?'} ${predicate(clue, context)}.`;
  }
}
