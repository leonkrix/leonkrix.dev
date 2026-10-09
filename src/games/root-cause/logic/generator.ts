import { createRandom, type Random } from '../../shared/random';
import { Board } from './board';
import {
  check,
  clueLevelOf,
  type Context,
  isNeutral,
  isSolution,
  mentions,
  subjectOf,
} from './clues';
import { generateLayout } from './layout';
import { countByPropagation, rate, type Rating } from './propagation';
import { kindsOf, type Skin } from './skin';
import { solve } from './solver';
import {
  type Cell,
  type Clue,
  type ClueType,
  type Counting,
  type Direction,
  type Layout,
  type Level,
  type Line,
  type NeutralClue,
  type Person,
  type PersonClue,
  type RoomRelation,
  type Tier,
} from './types';

/** The hardest clue level that a tier may use, and the hardest reasoning that it may ask for */
const MAX_LEVEL: Readonly<Record<Tier, 1 | 2 | 3>> = { easy: 1, medium: 2, hard: 3 };

/** How many clues about the whole map a level has, at least and at most, by tier */
const NEUTRAL_COUNTS: Readonly<Record<Tier, readonly [number, number]>> = {
  easy: [0, 1],
  medium: [0, 2],
  hard: [1, 3],
};

/**
 * How often a kind of clue is chosen compared with the others. The clues about distances and
 * between are strong but tiring to read, so they are picked rarely.
 */
const TYPE_WEIGHT: Partial<Record<ClueType, number>> = {
  distance: 0.25,
  between: 0.25,
  or: 0.5,
  and: 0.8,
};

/** At most this share of the clues may be of one kind, and of the hardest level, in a bigger level */
const MAX_SHARE_OF_ONE_TYPE = 1 / 3;
const MAX_SHARE_OF_LEVEL_THREE = 0.4;

/** The tier that goes with a rating: the harder of the reasoning and the clues, or none if it is too hard. */
export function tierOf(rating: Pick<Rating, 'solved' | 'level' | 'clueLevel'>): Tier | undefined {
  if (!rating.solved || rating.level === 4) {
    return undefined;
  }
  const level = Math.max(rating.level, rating.clueLevel);
  return level === 1 ? 'easy' : level === 2 ? 'medium' : 'hard';
}

/**
 * The people of a level: suspects with random roles, and the victim last. The victim has the
 * given role or a random one of the skin, and no suspect has the role of the victim.
 */
export function makePeople(
  skin: Skin,
  size: number,
  random: Random,
  victimRole?: string,
): Person[] {
  const victim = victimRole ?? random.pick(skin.victimRoles);
  if (!skin.victimRoles.includes(victim)) {
    throw new RangeError(`${victim} is not a victim role of ${skin.id}`);
  }
  const available = skin.roles.filter((role) => role !== victim);
  // Fewer roles than suspects, so that clues like "with two developers" can happen
  const roleCount = Math.min(available.length, Math.max(2, Math.floor((size - 1) * 0.6) + 1));
  const roles = random.shuffle(available).slice(0, roleCount);
  const suspectRoles = Array.from({ length: size - 1 }, () => random.pick(roles));
  const allRoles = [...suspectRoles, victim];

  if (skin.naming.style === 'devices') {
    const { prefixes } = skin.naming;
    const counts = new Map<string, number>();
    return allRoles.map((role) => {
      const prefix = prefixes[role] ?? role;
      const number = (counts.get(role) ?? 0) + 1;
      counts.set(role, number);
      return {
        role,
        name: `${prefix}-${String(number).padStart(2, '0')}`,
        label: `${prefix}${String(number)}`,
      };
    });
  }

  const labels = new Set<string>();
  const chosen: { name: string; label: string }[] = [];
  for (const entry of random.shuffle(skin.naming.pool)) {
    if (!labels.has(entry.label)) {
      labels.add(entry.label);
      chosen.push(entry);
    }
    if (chosen.length === size) {
      break;
    }
  }
  if (chosen.length < size) {
    throw new Error('The name pool has too few different labels');
  }
  return allRoles.map((role, index) => ({ role, ...(chosen[index] ?? { name: '?', label: '?' }) }));
}

/** One person in every row and column, none on a blocked cell, found by trying random choices. */
function randomPermutation(board: Board, random: Random): Cell[] | undefined {
  const { size } = board;
  const used = new Set<number>();
  const cells: Cell[] = [];
  const place = (row: number): boolean => {
    if (row === size) {
      return true;
    }
    for (const col of random.shuffle(Array.from({ length: size }, (_, index) => index))) {
      const cell = board.cellAt(row, col);
      if (used.has(col) || board.blocked.has(cell)) {
        continue;
      }
      used.add(col);
      cells.push(cell);
      if (place(row + 1)) {
        return true;
      }
      cells.pop();
      used.delete(col);
    }
    return false;
  };
  return place(0) ? cells : undefined;
}

/**
 * Chooses where everybody stands: one in every row and column, and the victim in a room with
 * exactly one suspect, who is the culprit.
 */
export function sampleSolution(board: Board, random: Random): Cell[] | undefined {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const cells = randomPermutation(board, random);
    if (cells === undefined) {
      return undefined;
    }
    const inRoom = (room: number | undefined): number =>
      cells.filter((cell) => board.roomOf[cell] === room).length;
    const victimCells = cells.filter((cell) => inRoom(board.roomOf[cell]) === 2);
    if (victimCells.length === 0) {
      continue;
    }
    const victim = random.pick(victimCells);
    const suspects = random.shuffle(cells.filter((cell) => cell !== victim));
    return [...suspects, victim];
  }
  return undefined;
}

const LINES: readonly Line[] = [
  'firstRow',
  'lastRow',
  'firstCol',
  'lastCol',
  'middleRow',
  'middleCol',
];
const CARDINAL: readonly Direction[] = ['north', 'south', 'east', 'west'];
const DIAGONAL: readonly Direction[] = ['northeast', 'northwest', 'southeast', 'southwest'];
const COUNTINGS: readonly Counting[] = ['atLeast', 'exactly'];
const RELATIONS: readonly RoomRelation[] = ['same', 'other'];

/** Every clue about one suspect, whether it is true or not, in all its variations. */
function personClueInstances(
  context: Context,
  layout: Layout,
  kinds: Level['kinds'],
  person: number,
): PersonClue[] {
  const { board, people, victim } = context;
  const suspects = Array.from({ length: victim }, (_, index) => index);
  const roles = [...new Set(people.map((entry) => entry.role))];
  const allKinds = [...new Set(layout.objects.map((object) => object.kind))];
  const standKinds = allKinds.filter((kind) => kinds[kind]?.occupiable === true);
  const roomTypes = [...new Set(board.roomType)];
  const found: PersonClue[] = [];

  for (let room = 0; room < board.roomCount; room += 1) {
    found.push({ type: 'inRoom', person, room }, { type: 'notInRoom', person, room });
  }
  for (const roomType of roomTypes) {
    found.push(
      { type: 'inRoomType', person, roomType },
      { type: 'notInRoomType', person, roomType },
    );
  }
  found.push(
    { type: 'roomHasWindow', person, has: true },
    { type: 'roomHasWindow', person, has: false },
    { type: 'roomSize', person, which: 'largest' },
    { type: 'roomSize', person, which: 'smallest' },
    { type: 'onFurniture', person },
    { type: 'onFloor', person },
    { type: 'windowFront', person },
    { type: 'corner', person },
    { type: 'nextToWall', person },
    { type: 'notNextToWall', person },
    { type: 'alone', person },
  );
  for (const kind of allKinds) {
    found.push(
      { type: 'roomHasKind', person, kind, has: true },
      { type: 'roomHasKind', person, kind, has: false },
      { type: 'nextToKind', person, kind },
      { type: 'notNextToKind', person, kind },
    );
    for (const axis of ['row', 'col'] as const) {
      for (const where of RELATIONS) {
        found.push({ type: 'kindInLine', person, kind, axis, where });
      }
    }
    for (const direction of [...CARDINAL, ...DIAGONAL]) {
      for (const where of [...RELATIONS, 'any'] as const) {
        found.push({ type: 'relativeToKind', person, kind, direction, where });
      }
    }
  }
  for (const kind of standKinds) {
    found.push(
      { type: 'onKind', person, kind },
      { type: 'notOnKind', person, kind },
      { type: 'soleOnKind', person, kind },
    );
  }
  for (const line of LINES) {
    found.push({ type: 'line', person, line });
  }
  for (const counting of COUNTINGS) {
    for (const n of [1, 2, 3]) {
      found.push({ type: 'roomMates', person, counting, n });
    }
  }
  for (const role of roles) {
    for (const n of [1, 2]) {
      found.push(
        { type: 'roomRole', person, role, counting: 'atLeast', n },
        { type: 'roomRole', person, role, counting: 'exactly', n },
      );
    }
    found.push({ type: 'roomRole', person, role, counting: 'none', n: 0 });
  }
  for (const other of suspects) {
    if (other === person) {
      continue;
    }
    found.push(
      { type: 'sameRoom', person, other },
      { type: 'notSameRoom', person, other },
      { type: 'diagonal', person, other },
    );
    for (const direction of CARDINAL) {
      found.push({ type: 'direction', person, other, direction, mode: 'adjacent' });
    }
    for (const direction of [...CARDINAL, ...DIAGONAL]) {
      found.push({ type: 'direction', person, other, direction, mode: 'any' });
    }
    for (let distance = 1; distance <= 2 * (board.size - 1); distance += 1) {
      found.push({ type: 'distance', person, other, distance });
    }
    for (const third of suspects) {
      if (third > other && third !== person) {
        found.push(
          { type: 'between', person, other, third, axis: 'row' },
          { type: 'between', person, other, third, axis: 'col' },
        );
      }
    }
  }
  return found;
}

/** Clues about the whole map, in all their variations (the generator keeps the true ones). */
function neutralClueInstances(
  context: Context,
  layout: Layout,
  kinds: Level['kinds'],
  random: Random,
): NeutralClue[] {
  const { board, people, victim } = context;
  const suspects = Array.from({ length: victim }, (_, index) => index);
  const suspectRoles = [...new Set(suspects.flatMap((person) => people[person]?.role ?? []))];
  const allKinds = [...new Set(layout.objects.map((object) => object.kind))];
  const standKinds = allKinds.filter((kind) => kinds[kind]?.occupiable === true);
  const found: NeutralClue[] = [];

  for (let room = 0; room < board.roomCount; room += 1) {
    found.push({ type: 'roomEmpty', room });
    for (let n = 0; n <= board.size; n += 1) {
      found.push({ type: 'roomCount', room, n });
    }
  }
  for (let n = 0; n <= board.roomCount; n += 1) {
    found.push({ type: 'emptyRooms', n });
  }
  for (const kind of standKinds) {
    found.push({ type: 'kindCount', kind, counting: 'exactly', n: 0 });
    for (let n = 1; n <= board.size; n += 1) {
      found.push(
        { type: 'kindCount', kind, counting: 'atLeast', n },
        { type: 'kindCount', kind, counting: 'exactly', n },
      );
    }
    const objects = board.objectCount.get(kind) ?? 0;
    if (objects >= 2) {
      for (let n = 0; n <= objects; n += 1) {
        found.push({ type: 'kindFree', kind, n });
      }
    }
    for (let n = 0; n <= 2; n += 1) {
      found.push({ type: 'everyRoomKind', kind, n });
    }
  }
  for (const role of suspectRoles) {
    for (const kind of allKinds) {
      found.push({ type: 'noRoleNextToKind', role, kind });
    }
  }
  found.push({ type: 'distinctRoomCounts' }, { type: 'rolesApart' });
  for (let n = 0; n <= board.size; n += 1) {
    found.push({ type: 'cornerCount', n });
  }
  // A few groups of three suspects who are in different rooms
  for (let index = 0; index < 12 && suspects.length >= 3; index += 1) {
    const persons = random
      .shuffle(suspects)
      .slice(0, 3)
      .sort((a, b) => a - b);
    found.push({ type: 'separate', persons });
  }
  return found;
}

/** The people that a clue is about and mentions, as a set: used to keep combinations small */
function peopleOf(clue: Clue): Set<number> {
  const set = new Set(mentions(clue));
  const subject = subjectOf(clue);
  if (subject !== undefined) {
    set.add(subject);
  }
  return set;
}

/**
 * Every clue of the allowed levels that is true for the solution: about a suspect, about the
 * whole floor, and combinations of two clues about one suspect. Never about the victim.
 */
export function enumerateClues(
  context: Context,
  layout: Layout,
  kinds: Level['kinds'],
  solution: readonly Cell[],
  maxLevel: 1 | 2 | 3,
  random: Random,
): Clue[] {
  const found: Clue[] = [];
  const allowed = (clue: Clue): boolean => clueLevelOf(clue) <= maxLevel;
  const holds = (clue: Clue): boolean => check(clue, context, solution) === true;

  for (let person = 0; person < context.victim; person += 1) {
    const instances = personClueInstances(context, layout, kinds, person);
    const truths = instances.filter((clue) => holds(clue));
    const falsehoods = instances.filter((clue) => !holds(clue));
    found.push(...truths.filter(allowed));

    // Two clues about the same person in one: both must hold (and), or at least one (or)
    const small = (first: PersonClue, second: PersonClue): boolean =>
      first.type !== second.type &&
      first.type !== 'between' &&
      second.type !== 'between' &&
      new Set([...peopleOf(first), ...peopleOf(second)]).size <= 2;
    for (let count = 0; count < 12 && truths.length > 1; count += 1) {
      const first = random.pick(truths);
      const second = random.pick(truths);
      const and: Clue = { type: 'and', person, parts: [first, second] };
      if (small(first, second) && allowed(and)) {
        found.push(and);
      }
      const wrong = falsehoods.length > 0 ? random.pick(falsehoods) : undefined;
      if (wrong !== undefined && small(first, wrong)) {
        const or: Clue = {
          type: 'or',
          person,
          parts: random.int(2) === 0 ? [first, wrong] : [wrong, first],
        };
        if (allowed(or)) {
          found.push(or);
        }
      }
    }
  }
  const neutral = neutralClueInstances(context, layout, kinds, random);
  found.push(...neutral.filter((clue) => holds(clue) && allowed(clue)));
  return found;
}

interface Build {
  layout: Layout;
  kinds: Level['kinds'];
  people: readonly Person[];
  context: Context;
}

/**
 * Whether a set of clues is certainly not unique: the search found a second solution or none. A
 * search that gave up says nothing, the rater then decides (what the rules can solve is unique).
 */
function isCertainlyNotUnique(build: Build, clues: readonly Clue[]): boolean {
  const result = solve(
    { layout: build.layout, kinds: build.kinds, people: build.people, clues },
    { limit: 2, maxNodes: 300_000 },
  );
  return result.complete && result.count !== 1;
}

/** Whether a set of clues is varied enough, as a share of all of them */
export function isVaried(clues: readonly Clue[]): boolean {
  if (clues.length < 4) {
    return true;
  }
  const counts = new Map<string, number>();
  for (const clue of clues) {
    counts.set(clue.type, (counts.get(clue.type) ?? 0) + 1);
  }
  if (counts.size < 3) {
    return false;
  }
  if (clues.length >= 6 && Math.max(...counts.values()) / clues.length > MAX_SHARE_OF_ONE_TYPE) {
    return false;
  }
  if (clues.length >= 5) {
    const hardest = clues.filter((clue) => clueLevelOf(clue) === 3).length;
    if (hardest / clues.length > MAX_SHARE_OF_LEVEL_THREE) {
      return false;
    }
  }
  return true;
}

/**
 * Picks clues until the puzzle can be solved by reasoning of the allowed level (which also means
 * that the solution is the only one), then takes away every clue that is not needed for that.
 * Every suspect keeps at least one clue, the kinds of clues are mixed, and the wanted number of
 * clues about the whole map stays (they are only kept when they are needed).
 */
export function chooseClues(
  build: Build,
  candidates: readonly Clue[],
  random: Random,
  maxReasoning: 1 | 2 | 3,
  neutralWanted = 0,
  neutralMost = Number.POSITIVE_INFINITY,
): Clue[] | undefined {
  const { victim } = build.context;
  const used = new Map<string, number>();
  const chosen: Clue[] = [];
  let pool = [...candidates];

  const take = (clue: Clue): void => {
    chosen.push(clue);
    used.set(clue.type, (used.get(clue.type) ?? 0) + 1);
    pool = pool.filter((other) => other !== clue);
  };

  /** A random clue from the list: kinds that are used less often, or weighted down, are rarer */
  const pickFrom = (list: readonly Clue[]): Clue | undefined => {
    if (list.length === 0) {
      return undefined;
    }
    const weights = list.map(
      (clue) => (TYPE_WEIGHT[clue.type] ?? 1) / (1 + (used.get(clue.type) ?? 0)) ** 2,
    );
    let point = random.next() * weights.reduce((sum, weight) => sum + weight, 0);
    for (const [index, weight] of weights.entries()) {
      point -= weight;
      if (point < 0) {
        return list[index];
      }
    }
    return list.at(-1);
  };

  /** Unique (a quick check with the search to turn most sets down), and solved by the rules without too much reasoning */
  const solvable = (clues: readonly Clue[]): boolean => {
    if (isCertainlyNotUnique(build, clues)) {
      return false;
    }
    const rating = rate({ layout: build.layout, kinds: build.kinds, people: build.people, clues });
    return rating.solved && rating.level <= maxReasoning;
  };

  // The clues about the whole map first, then every suspect gets one
  for (let index = 0; index < neutralWanted; index += 1) {
    const clue = pickFrom(pool.filter(isNeutral));
    if (clue !== undefined) {
      take(clue);
    }
  }
  for (let person = 0; person < victim; person += 1) {
    const clue = pickFrom(pool.filter((entry) => subjectOf(entry) === person));
    if (clue !== undefined) {
      take(clue);
    }
  }

  while (!solvable(chosen)) {
    // Not more clues about the whole map than the level may have
    const full = chosen.filter(isNeutral).length >= neutralMost;
    const clue = pickFrom(full ? pool.filter((entry) => !isNeutral(entry)) : pool);
    if (clue === undefined) {
      return undefined;
    }
    take(clue);
  }

  // Take away what is not needed: the clues about people first, so the ones about the map stay
  // as long as they carry something
  const order = [
    ...random.shuffle(chosen.filter((clue) => !isNeutral(clue))),
    ...random.shuffle(chosen.filter(isNeutral)),
  ];
  // The rater is not strictly monotonic (a clue can change the route of the reasoning), so go
  // around again until nothing more can go
  let removed = true;
  while (removed) {
    removed = false;
    for (const clue of order) {
      if (!chosen.includes(clue)) {
        continue;
      }
      const rest = chosen.filter((other) => other !== clue);
      const subject = subjectOf(clue);
      const stillCovered =
        subject === undefined || rest.some((other) => subjectOf(other) === subject);
      if (stillCovered && solvable(rest)) {
        chosen.splice(chosen.indexOf(clue), 1);
        removed = true;
      }
    }
  }

  if (chosen.filter(isNeutral).length < neutralWanted || !isVaried(chosen)) {
    return undefined;
  }
  return chosen;
}

export interface Generated {
  level: Level;
  rating: Rating;
  tier: Tier;
  /** How many maps were tried until one gave a puzzle of the wanted tier */
  attempts: number;
}

/**
 * Makes a puzzle of the given size and tier. The same seed always makes the same puzzle. It tries
 * maps until one gives a unique puzzle that the rater puts into the wanted tier, and
 * returns nothing if none was found within the attempts.
 */
export function generateLevel(
  skin: Skin,
  size: number,
  tier: Tier,
  seed: number | string,
  { maxAttempts = 200, victimRole }: { maxAttempts?: number; victimRole?: string } = {},
): Generated | undefined {
  const random = createRandom(seed);
  const kinds = kindsOf(skin);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const layout = generateLayout(skin, size, tier, random);
    const board = new Board(layout, kinds);
    const solution = sampleSolution(board, random);
    if (solution === undefined) {
      continue;
    }
    const people = makePeople(skin, size, random, victimRole);
    const context: Context = { board, people, victim: size - 1 };
    const candidates = enumerateClues(context, layout, kinds, solution, MAX_LEVEL[tier], random);
    const [fewest, most] = NEUTRAL_COUNTS[tier];
    const neutralWanted = fewest + random.int(most - fewest + 1);
    const clues = chooseClues(
      { layout, kinds, people, context },
      candidates,
      random,
      MAX_LEVEL[tier],
      neutralWanted,
      most,
    );
    if (clues === undefined) {
      continue;
    }
    const level: Level = { layout, kinds, people, clues, solution };
    const rating = rate(level);
    if (tierOf(rating) === tier) {
      return { level, rating, tier, attempts: attempt };
    }
  }
  return undefined;
}

/**
 * Everything that must be true of a level before it is published, as a list of problems (empty
 * when the level is fine). Two solvers that share no search code must both find exactly one
 * solution, and it must be the stored one.
 */
export function problemsOf(level: Level): string[] {
  const problems: string[] = [];
  const { layout, people, clues, solution } = level;
  const board = new Board(layout, level.kinds);
  const context: Context = { board, people, victim: people.length - 1 };

  if (people.length !== layout.size || solution.length !== layout.size) {
    problems.push('the number of people is not the size of the board');
    return problems;
  }
  if (layout.rooms.length !== layout.roomCount) {
    problems.push('the rooms do not all have a type and a name');
  }
  if (new Set(layout.rooms.map((room) => room.name)).size !== layout.rooms.length) {
    problems.push('a room name is used twice');
  }
  if (new Set(people.map((person) => person.label)).size !== people.length) {
    problems.push('a label is used twice');
  }
  if (new Set(people.map((person) => person.name)).size !== people.length) {
    problems.push('a name is used twice');
  }
  if (
    new Set(solution.map((cell) => board.row(cell))).size !== layout.size ||
    new Set(solution.map((cell) => board.col(cell))).size !== layout.size
  ) {
    problems.push('the solution does not have one person in every row and column');
  }
  if (solution.some((cell) => board.blocked.has(cell))) {
    problems.push('somebody stands on a blocked cell');
  }
  if (!isSolution(clues, context, solution)) {
    problems.push('the stored solution breaks a clue or the rule about the victim');
  }
  for (let person = 0; person < context.victim; person += 1) {
    if (!clues.some((clue) => subjectOf(clue) === person)) {
      problems.push(`the suspect ${people[person]?.name ?? String(person)} has no clue`);
    }
  }
  if (clues.some((clue) => peopleOf(clue).has(context.victim))) {
    problems.push('a clue is about the victim or names the victim');
  }

  const search = solve(level, { limit: 2, maxNodes: 5_000_000 });
  if (!search.complete || search.count !== 1 || search.solutions[0]?.join() !== solution.join()) {
    problems.push(
      `the search solver finds ${search.complete ? String(search.count) : 'an unknown number of'} solutions, not exactly the stored one`,
    );
  }
  const rules = countByPropagation(level, 2, 5_000_000);
  if (!rules.complete || rules.count !== 1 || rules.solutions[0]?.join() !== solution.join()) {
    problems.push(
      `the rule solver finds ${rules.complete ? String(rules.count) : 'an unknown number of'} solutions, not exactly the stored one`,
    );
  }
  return problems;
}
