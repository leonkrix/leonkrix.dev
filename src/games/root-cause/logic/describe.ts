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
  /**
   * Kinds of objects that another clue of the level says nobody is on ("Nobody is on a rug"). A
   * clue "on a chair, a rug or a sofa" would repeat that, so it leaves them out.
   */
  nobodyOn?: ReadonlySet<string>;
}

/** The kinds of objects that a clue of the list says nobody is on */
export function kindsNobodyIsOn(clues: readonly Clue[]): ReadonlySet<string> {
  return new Set(
    clues.flatMap((clue) =>
      clue.type === 'kindCount' && clue.counting === 'exactly' && clue.n === 0 ? [clue.kind] : [],
    ),
  );
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

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
];

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

function countText(counting: Counting, n: number): string {
  return `${counting === 'atLeast' ? 'at least' : 'exactly'} ${number(n)}`;
}

function relationText(where: RoomRelation | 'any'): string {
  return where === 'same' ? ' in the same room' : where === 'other' ? ' in another room' : '';
}

/**
 * How a clue speaks about a kind of room, an object or a role: with "the" and the singular when
 * there is only one of it on the map ("in the data hall", "on the rug", "the developer"), and with
 * "a" or the plural when there are several. That is simpler to read and says that there is no
 * choice to be made.
 */
interface Mentions {
  roomType: (id: string) => string;
  kindOne: (id: string) => string;
  kindMany: (id: string) => string;
  /** "the room with" when only one object of the kind is on the map (so only one room has it), else "a room with" */
  roomWith: (id: string) => string;
  /** The role with its article, "the" when only one person has it */
  roleOne: (role: string) => string;
  roleMany: (role: string) => string;
  /** Whether exactly one person has the role */
  roleUnique: (role: string) => boolean;
}

function mentionsOf(context: DescribeContext): Mentions {
  const { skin, words, layout, people } = context;
  const count = (items: readonly string[], wanted: string): number =>
    items.filter((item) => item === wanted).length;
  const types = layout.rooms.map((room) => room.type);
  const kinds = layout.objects.map((object) => object.kind);
  const roles = people.map((person) => person.role);
  const single = (value: Noun): string => `the ${bare(value)}`;

  const roleUnique = (role: string): boolean => count(roles, role) === 1;
  return {
    roomType: (id) => {
      const text = typeText(skin, id);
      return count(types, id) === 1 ? `the ${text}` : `${article(text)} ${text}`;
    },
    kindOne: (id) => {
      const value = noun(words.kinds, id);
      return count(kinds, id) === 1 ? single(value) : value.one;
    },
    roomWith: (id) => (count(kinds, id) === 1 ? 'the room with' : 'a room with'),
    kindMany: (id) => {
      const value = noun(words.kinds, id);
      return count(kinds, id) === 1 ? single(value) : value.plural;
    },
    roleOne: (role) => {
      const value = noun(words.roles, role);
      return roleUnique(role) ? single(value) : value.one;
    },
    roleMany: (role) => {
      const value = noun(words.roles, role);
      return roleUnique(role) ? single(value) : value.plural;
    },
    roleUnique,
  };
}

/** The kinds of objects that people can be on and that are on this map: a clue names no other */
function occupiableKinds(context: DescribeContext, mentions: Mentions): string {
  const present = new Set(context.layout.objects.map((object) => object.kind));
  const possible = Object.entries(context.kinds).filter(
    ([id, info]) => info.occupiable && present.has(id),
  );
  // Without the kinds that another clue rules out, as long as something is left
  const open = possible.filter(([id]) => context.nobodyOn?.has(id) !== true);
  return listOf((open.length > 0 ? open : possible).map(([id]) => mentions.kindOne(id)));
}

/**
 * The part of a sentence that follows the name of a suspect: "is next to a plant". The victim
 * is never the subject of a clue.
 */
function predicate(clue: PersonClue, context: DescribeContext, mentions: Mentions): string {
  const { words, people, layout } = context;
  const name = (person: number): string => people[person]?.name ?? '?';
  const kind = (id: string): Noun => noun(words.kinds, id);

  switch (clue.type) {
    case 'inRoom':
      return `is in ${roomText(layout, clue.room)}`;
    case 'notInRoom':
      return `is not in ${roomText(layout, clue.room)}`;
    case 'inRoomType':
      return `is in ${mentions.roomType(clue.roomType)}`;
    case 'notInRoomType':
      return `is not in ${mentions.roomType(clue.roomType)}`;
    case 'sameRoom':
      return `is in the same room as ${name(clue.other)}`;
    case 'notSameRoom':
      return `is not in the same room as ${name(clue.other)}`;
    case 'roomHasWindow':
      return clue.has ? 'is in a room with a window' : 'is in a room without a window';
    case 'roomHasKind':
      // An object there is only one of is in exactly one room: "the room with the shelf"
      return clue.has
        ? `is in ${mentions.roomWith(clue.kind)} ${mentions.kindOne(clue.kind)}`
        : `is in a room without ${mentions.kindMany(clue.kind)}`;
    case 'roomSize':
      return `is in the ${clue.which} room`;
    case 'onKind':
      return `${kind(clue.kind).on ?? 'is on'} ${mentions.kindOne(clue.kind)}`;
    case 'notOnKind':
      return `${kind(clue.kind).notOn ?? 'is not on'} ${mentions.kindOne(clue.kind)}`;
    case 'onFurniture':
      return `is on ${occupiableKinds(context, mentions)}`;
    case 'onFloor':
      return 'is on the bare floor, not on an object';
    case 'soleOnKind':
      return `is the only ${words.person} on ${mentions.kindOne(clue.kind)}`;
    case 'nextToKind':
      return `is next to ${mentions.kindOne(clue.kind)}`;
    case 'notNextToKind':
      return `is not next to ${mentions.kindOne(clue.kind)}`;
    case 'windowFront':
      return 'is in front of a window';
    case 'kindInLine':
      // The object only has to be in the row or column, a person on it is in it too
      return `is in the same ${clue.axis === 'row' ? 'row' : 'column'} as ${mentions.kindOne(clue.kind)} in ${clue.where === 'same' ? 'the same room' : 'another room'}`;
    case 'relativeToKind':
      return `is ${DIRECTION_TEXT[clue.direction]} of ${mentions.kindOne(clue.kind)}${relationText(clue.where)}`;
    case 'corner':
      return `is in a corner of the ${words.place}`;
    case 'roomCorner':
      return 'is in a corner of their room';
    case 'cornerOfRoom':
      return `is in a corner of ${roomText(layout, clue.room)}`;
    case 'line':
      return `is in ${LINE_TEXT[clue.line]}`;
    case 'rowCol':
      return `is in the ${ORDINALS[clue.index] ?? String(clue.index + 1)} ${clue.axis === 'row' ? 'row' : 'column'}`;
    case 'nextToWall':
      return 'is next to a wall';
    case 'notNextToWall':
      return 'is not next to a wall';
    case 'alone':
      return 'is alone in the room';
    case 'roomMates':
      return `shares a room with ${countText(clue.counting, clue.n)} ${clue.n === 1 ? `other ${words.person}` : `other ${words.people}`}`;
    case 'roomRole': {
      const own = people[clue.person]?.role === clue.role;
      const value = noun(words.roles, clue.role);
      // The only person with the role is named by it: "with the firewall"
      if (!own && mentions.roleUnique(clue.role)) {
        return clue.counting === 'none'
          ? `is in a room without ${mentions.roleOne(clue.role)}`
          : `is in the room with ${mentions.roleOne(clue.role)}`;
      }
      const others = own ? `other ${value.plural}` : value.plural;
      if (clue.counting === 'none') {
        return `is in a room with no ${others}`;
      }
      const single = own ? `other ${bare(value)}` : bare(value);
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

function neutralText(clue: NeutralClue, context: DescribeContext, mentions: Mentions): string {
  const { words, people, layout } = context;
  const nobody = words.nobody;

  switch (clue.type) {
    case 'roomEmpty':
      return `${nobody} is in ${roomText(layout, clue.room)}.`;
    case 'roomCount':
      if (clue.n === 0) {
        return `${nobody} is in ${roomText(layout, clue.room)}.`;
      }
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
        return `${nobody} is on ${mentions.kindOne(clue.kind)}.`;
      }
      return `${clue.counting === 'atLeast' ? 'At least' : 'Exactly'} ${number(clue.n)} ${clue.n === 1 ? `${words.person} is` : `${words.people} are`} on ${clue.n === 1 ? mentions.kindOne(clue.kind) : mentions.kindMany(clue.kind)}.`;
    case 'kindFree':
      if (clue.n === 0) {
        return `Every one of the ${mentions.kindMany(clue.kind)} has a ${words.person} on it.`;
      }
      return clue.n === 1
        ? `Exactly one of the ${mentions.kindMany(clue.kind)} has ${nobody.toLowerCase()} on it.`
        : `Exactly ${number(clue.n)} of the ${mentions.kindMany(clue.kind)} have ${nobody.toLowerCase()} on them.`;
    case 'distinctRoomCounts':
      return `Every room holds a different number of ${words.people}.`;
    case 'everyRoomKind':
      if (clue.n === 0) {
        return `${nobody} is on ${mentions.kindOne(clue.kind)} in any room.`;
      }
      return `Every room has exactly ${number(clue.n)} ${clue.n === 1 ? words.person : words.people} on ${clue.n === 1 ? mentions.kindOne(clue.kind) : mentions.kindMany(clue.kind)}.`;
    case 'noRoleNextToKind': {
      const role = noun(words.roles, clue.role);
      // With one person of the role it is about that person: "The developer is not next to a desk"
      return mentions.roleUnique(clue.role)
        ? `The ${bare(role)} is not next to ${mentions.kindOne(clue.kind)}.`
        : `No ${bare(role)} is next to ${mentions.kindOne(clue.kind)}.`;
    }
    case 'rolesApart':
      return `No two ${words.people} ${words.sameRole} share a room.`;
    case 'separate': {
      const names = clue.persons.map((person) => people[person]?.name ?? '?');
      return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''} are all in different rooms.`;
    }
    case 'cornerCount':
      if (clue.n === 0) {
        return `${nobody} is in a corner of the ${words.place}.`;
      }
      return `Exactly ${number(clue.n)} ${clue.n === 1 ? `${words.person} is` : `${words.people} are`} in a corner of the ${words.place}.`;
  }
}

/** Without its "is": "is next to a plant" gives "next to a plant" */
function withoutIs(text: string): string {
  return text.startsWith('is ') ? text.slice(3) : text;
}

/** The text of a clue, as a sentence with a full stop. */
export function describeClue(clue: Clue, context: DescribeContext): string {
  const mentions = mentionsOf(context);
  switch (clue.type) {
    case 'and':
    case 'or': {
      const name = context.people[clue.person]?.name ?? '?';
      const [first = '', second = ''] = clue.parts.map((part) =>
        predicate(part, context, mentions),
      );
      const bothIs = first.startsWith('is ') && second.startsWith('is ');
      if (clue.type === 'and') {
        return `${name} ${first} and ${bothIs ? withoutIs(second) : second}.`;
      }
      return bothIs
        ? `${name} is either ${withoutIs(first)} or ${withoutIs(second)}.`
        : `${name} either ${first} or ${second}.`;
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
      return neutralText(clue, context, mentions);
    default:
      return `${context.people[clue.person]?.name ?? '?'} ${predicate(clue, context, mentions)}.`;
  }
}
