import { candidates, deduce, engineOf, initialState, type TraceStep } from './propagation';
import { type Cell, type Level } from './types';

/**
 * Why a person belongs where a hint says, as the steps of the reasoning in the order a player can
 * follow them. Every step says how many cells are left for the person afterwards. The steps are
 * worked out from the same reasoning as the rater and the hints (`deduce`), so they are never
 * made up: each one is something that really narrows the cells down.
 */
export type ExplainStep =
  /** The clues that the people on the map break (a hint about a mistake starts with them) */
  | { kind: 'broken'; clues: number[] }
  /** What the clues about the person alone leave, and which clues those are */
  | { kind: 'clues'; clues: number[]; cells: number }
  /**
   * The people who are placed on the map, and the ones whose own clues leave a single cell: nobody
   * else can use their rows and columns
   */
  | { kind: 'taken'; placed: number[]; pinned: number[]; cells: number }
  /**
   * More people with a single cell, or people who can only be in one row or column (named in
   * `bound`): nobody else can use that row or column
   */
  | { kind: 'chain'; people: number[]; bound: Bound[]; cells: number }
  /**
   * The clues that tie people together (north of, in the same room, apart, ...): `clues` are the
   * ones that are really needed here
   */
  | { kind: 'relations'; people: number[]; clues: number[]; cells: number }
  /** The rules about rooms: the victim rule and the clues about whole rooms or counting */
  | { kind: 'rooms'; rules: number[]; people: number[]; cells: number }
  /** Trying a cell and finding that a clue breaks */
  | { kind: 'whatif'; cells: number }
  /** Where the person belongs (or can only be) */
  | { kind: 'result'; cells: Cell[] };

/** A person who can only be in one row or column (the numbers start at 0) */
export interface Bound {
  person: number;
  line: 'row' | 'column';
  index: number;
}

/** The clue types that the rules about rooms work with, besides the rule about the victim */
const ROOM_RULES = new Set(['roomEmpty', 'soleOnKind', 'kindCount', 'emptyRooms', 'alone']);

/** The cells a person can stand on when only the clues about one person at a time are used */
function cellsByClues(level: Level, without: number | undefined, person: number): number {
  const clues = level.clues.filter((_, index) => index !== without);
  const engine = engineOf({ ...level, clues });
  const state = initialState(engine);
  return state === undefined ? 0 : candidates(state, person).length;
}

/**
 * The clues that really cut down the cells of a person on their own (taking one away would leave
 * more cells). That includes clues that are not about the person by name, such as "The designer is
 * not next to a desk" for the only designer.
 */
export function cluesThatLimit(level: Level, person: number): number[] {
  const all = cellsByClues(level, undefined, person);
  return level.clues.flatMap((_, index) =>
    cellsByClues(level, index, person) > all ? [index] : [],
  );
}

/** Who has exactly one cell left in a step of the trace */
function singles(step: TraceStep): Set<number> {
  return new Set(step.cells.flatMap((cells, person) => (cells.length === 1 ? [person] : [])));
}

/**
 * The steps that lead to the cells of one person. `placed` holds the people who stand in the right
 * place (only those are trusted); `broken` the clues that the map breaks, if the hint is about a
 * mistake.
 */
export function explain(
  level: Level,
  placed: readonly (Cell | undefined)[],
  person: number,
  broken: readonly number[] = [],
): ExplainStep[] {
  const trace: TraceStep[] = [];
  const deductions = deduce(level, placed, trace);
  const first = trace[0];
  const start = trace[1];
  if (deductions === undefined || first === undefined || start === undefined) {
    return [];
  }
  const count = (step: TraceStep): number => step.cells[person]?.length ?? 0;
  const finalCells = deductions[person]?.cells ?? [];
  const steps: ExplainStep[] = [];
  if (broken.length > 0) {
    steps.push({ kind: 'broken', clues: [...broken] });
  }
  steps.push({ kind: 'clues', clues: cluesThatLimit(level, person), cells: count(first) });
  if (count(first) === finalCells.length) {
    // The clues about the person alone already say it: nobody else is needed
    steps.push({ kind: 'result', cells: finalCells });
    return steps;
  }

  const size = level.layout.size;
  const shares = (a: number, b: number): boolean =>
    Math.floor(a / size) === Math.floor(b / size) || a % size === b % size;

  /**
   * Of some people who have a single cell, the ones whose rows and columns take the cells away
   * that this step took from the person (the fewest that explain all of them). When they do not
   * explain everything on their own (the reasoning has more than one stage), all of them stay and
   * `complete` is false.
   */
  const needed = (
    people: readonly number[],
    from: TraceStep,
    to: TraceStep,
  ): { people: number[]; complete: boolean } => {
    const kept = new Set(to.cells[person] ?? []);
    let open = (from.cells[person] ?? []).filter((cell) => !kept.has(cell));
    if (open.length === 0) {
      return { people: [...people], complete: false };
    }
    const spot = (other: number): number | undefined => {
      const cells = to.cells[other] ?? [];
      return cells.length === 1 ? cells[0] : undefined;
    };
    const chosen: number[] = [];
    let rest = [...people];
    while (open.length > 0) {
      const gains = rest.map((other) => {
        const at = spot(other);
        return at === undefined ? 0 : open.filter((cell) => shares(cell, at)).length;
      });
      const best = Math.max(...gains, 0);
      if (best === 0) {
        return { people: [...people], complete: false };
      }
      const index = gains.indexOf(best);
      const other = rest[index] ?? 0;
      const at = spot(other) ?? 0;
      chosen.push(other);
      open = open.filter((cell) => !shares(cell, at));
      rest = rest.filter((_, position) => position !== index);
    }
    return { people: people.filter((other) => chosen.includes(other)), complete: true };
  };

  /**
   * The people who can only be in one row or column and so take that row or column from the
   * person: the fewest that explain every cell this step took (none when that is not enough)
   */
  const bounds = (from: TraceStep, to: TraceStep): Bound[] => {
    const kept = new Set(to.cells[person] ?? []);
    let open = (from.cells[person] ?? []).filter((cell) => !kept.has(cell));
    const options: Bound[] = [];
    from.cells.forEach((cells, other) => {
      const [head] = cells;
      if (other === person || head === undefined || cells.length < 2) {
        return;
      }
      if (cells.every((cell) => Math.floor(cell / size) === Math.floor(head / size))) {
        options.push({ person: other, line: 'row', index: Math.floor(head / size) });
      } else if (cells.every((cell) => cell % size === head % size)) {
        options.push({ person: other, line: 'column', index: head % size });
      }
    });
    const inLine = (bound: Bound, cell: number): boolean =>
      (bound.line === 'row' ? Math.floor(cell / size) : cell % size) === bound.index;
    const chosen: Bound[] = [];
    while (open.length > 0) {
      let best: Bound | undefined;
      let gain = 0;
      for (const option of options) {
        const count = open.filter((cell) => inLine(option, cell)).length;
        if (count > gain) {
          best = option;
          gain = count;
        }
      }
      if (best === undefined) {
        return [];
      }
      const pick = best;
      chosen.push(pick);
      open = open.filter((cell) => !inLine(pick, cell));
    }
    return chosen;
  };

  const givenPeople = placed.flatMap((cell, other) =>
    cell !== undefined && other !== person ? [other] : [],
  );
  const pinned = [...singles(start)].filter(
    (other) => other !== person && !givenPeople.includes(other),
  );
  let rest = trace.slice(2);
  let before = start;
  if (givenPeople.length > 0 || pinned.length > 0) {
    // The first pass over rows and columns is what the people on the map and the single cells do
    const pass = rest[0]?.label === 'cross' ? rest[0] : undefined;
    const taking = needed([...givenPeople, ...pinned], first, pass ?? start);
    const known = singles(start);
    // When the people of the step before already explain every cell that went, a chain is not needed
    const chain =
      pass !== undefined && !taking.complete
        ? needed(
            [...singles(pass)].filter((other) => other !== person && !known.has(other)),
            start,
            pass,
          ).people
        : [];
    const chainBound =
      pass !== undefined && !taking.complete && chain.length === 0 ? bounds(start, pass) : [];
    // With a chain after it, this step only counts what the rows and columns of its own people take
    const own =
      chain.length > 0 || chainBound.length > 0
        ? (first.cells[person] ?? []).filter(
            (cell) =>
              !taking.people.some((other) => {
                const at = start.cells[other]?.[0];
                return at !== undefined && shares(cell, at);
              }),
          ).length
        : 0;
    steps.push({
      kind: 'taken',
      placed: givenPeople.filter((other) => taking.people.includes(other)),
      pinned: pinned.filter((other) => taking.people.includes(other)),
      cells: Math.max(own, count(pass ?? start)),
    });
    if (pass !== undefined) {
      if (chain.length > 0 || chainBound.length > 0) {
        steps.push({ kind: 'chain', people: chain, bound: chainBound, cells: count(pass) });
      }
      before = pass;
      rest = rest.slice(1);
    }
  }

  for (const step of rest) {
    if (count(before) === 1) {
      break;
    }
    const known = singles(before);
    const people = needed(
      [...singles(step)].filter((other) => other !== person && !known.has(other)),
      before,
      step,
    ).people;
    if (count(step) !== count(before) || people.length > 0) {
      const last = steps.at(-1);
      const cells = count(step);
      if (step.label === 'cross') {
        const bound = people.length === 0 ? bounds(before, step) : [];
        if (last?.kind === 'chain') {
          last.people.push(...people);
          last.bound.push(...bound);
          last.cells = cells;
        } else {
          steps.push({ kind: 'chain', people, bound, cells });
        }
      } else if (step.label === 'relations') {
        if (last?.kind === 'relations') {
          last.people.push(...people);
          last.cells = cells;
        } else {
          steps.push({ kind: 'relations', people, clues: [], cells });
        }
      } else if (step.label === 'rooms') {
        steps.push({ kind: 'rooms', rules: [], people, cells });
      } else if (step.label === 'whatif') {
        // Two rounds of trying cells say the same: one step, with the cells that are left in the end
        if (last?.kind === 'whatif') {
          last.cells = cells;
        } else {
          steps.push({ kind: 'whatif', cells });
        }
      }
    }
    before = step;
  }

  // The clues that these steps rest on: the fewest that still lead to the same cells at the end of
  // the stage of the rules about rooms. Only those are named, each once, where they are used (the
  // ones about the person alone are in the first step). The what-if step names none: it is a search
  // through all clues and costs too much to take apart.
  const roomsStage = trace.find((step) => step.label === 'rooms');
  if (roomsStage !== undefined && steps.some((s) => s.kind === 'relations' || s.kind === 'rooms')) {
    const alone = new Set(cluesThatLimit(level, person));
    const named = new Set(alone);
    const needed = neededClues(level, placed, person, roomsStage.cells[person] ?? [], alone);
    const fresh = (wanted: (type: string) => boolean): number[] =>
      needed.filter((index) => !named.has(index) && wanted(level.clues[index]?.type ?? ''));
    for (const step of steps) {
      if (step.kind === 'relations') {
        step.clues = fresh((type) => !ROOM_RULES.has(type));
        step.clues.forEach((index) => named.add(index));
      } else if (step.kind === 'rooms') {
        step.rules = fresh((type) => ROOM_RULES.has(type));
        step.rules.forEach((index) => named.add(index));
      }
    }
  }
  steps.push({ kind: 'result', cells: finalCells });
  return steps;
}

/**
 * The fewest clues of the level that still lead to the same cells for the person (apart from the
 * ones about the person alone, which stay). Found by trying to do without each clue in turn: a clue
 * stays out when the reasoning gets to the same cells without it.
 */
function neededClues(
  level: Level,
  placed: readonly (Cell | undefined)[],
  person: number,
  finalCells: readonly Cell[],
  alone: ReadonlySet<number>,
): number[] {
  let kept = level.clues.map((_, index) => index);
  // The clues about the person alone stay: they are named in the first step anyway
  for (const index of kept.filter((i) => !alone.has(i))) {
    const rest = kept.filter((other) => other !== index);
    const clues = rest.flatMap((other) => {
      const clue = level.clues[other];
      return clue === undefined ? [] : [clue];
    });
    const cells = deduce({ ...level, clues }, placed, undefined, 'rooms')?.[person]?.cells;
    if (cells?.length === finalCells.length && cells.every((cell) => finalCells.includes(cell))) {
      kept = rest;
    }
  }
  return kept;
}

/** What the text of an explanation needs to know */
export interface ExplainWords {
  name: (person: number) => string;
  /** The text of a clue of the level, by its index */
  clue: (index: number) => string;
  /** The place of a cell: "row 2, column 3" */
  where: (cell: Cell) => string;
  /** What the victim is called ("victim", "failed device") */
  victim: string;
  /** The person of the hint, and whether that is the victim */
  person: number;
  isVictim: boolean;
}

function names(words: ExplainWords, people: readonly number[]): string {
  const list = people.map((person) => words.name(person));
  return list.length <= 1
    ? list.join('')
    : `${list.slice(0, -1).join(', ')} and ${list.at(-1) ?? ''}`;
}

function cellsText(n: number): string {
  return n === 1 ? 'one cell' : `${String(n)} cells`;
}

/** "Only one cell is left" or "5 cells are left", a whole sentence */
function leftText(n: number): string {
  return n === 1 ? 'Only one cell is left' : `${String(n)} cells are left`;
}

function quoted(words: ExplainWords, clues: readonly number[]): string {
  return clues.map((index) => `“${words.clue(index).replace(/.$/, '')}”`).join(', ');
}

/**
 * One sentence for every step. No sentence starts with a name, because the name of a device
 * ("nas-01") is written in lower case.
 */
export function explanationLines(steps: readonly ExplainStep[], words: ExplainWords): string[] {
  const me = words.name(words.person);
  return steps.map((step) => {
    switch (step.kind) {
      case 'broken':
        return `The people on the map break ${step.clues.length === 1 ? 'this clue' : 'these clues'}: ${quoted(words, step.clues)}.`;
      case 'clues':
        return step.clues.length === 0
          ? `No clue limits where ${me} can be, so every free cell is possible: ${cellsText(step.cells)}.`
          : `${step.clues.length === 1 ? 'The clue' : 'The clues'} ${quoted(words, step.clues)} ${step.clues.length === 1 ? 'leaves' : 'leave'} ${cellsText(step.cells)} for ${me}.`;
      case 'taken': {
        if (step.placed.length === 0 && step.pinned.length === 0) {
          return `The rows and columns that the other people need are taken. ${leftText(step.cells)} for ${me}.`;
        }
        const placed = `With ${names(words, step.placed)} on the map`;
        const pinned = `the clues leave ${names(words, step.pinned)} only one cell${step.pinned.length === 1 ? '' : ' each'}`;
        const lead =
          step.placed.length > 0 && step.pinned.length > 0
            ? `${placed}, and as ${pinned}`
            : step.placed.length > 0
              ? placed
              : `As ${pinned}`;
        return `${lead}, their rows and columns are taken. ${leftText(step.cells)} for ${me}.`;
      }
      case 'chain': {
        if (step.people.length > 0) {
          return `That leaves ${names(words, step.people)} only one cell, so ${step.people.length === 1 ? 'their row and column are' : 'their rows and columns are'} taken as well, and a row or column that only one person can still use goes to that person. ${leftText(step.cells)} for ${me}.`;
        }
        if (step.bound.length > 0) {
          const bound = step.bound.map(
            (one) =>
              `${words.name(one.person)} can only be in ${one.line} ${String(one.index + 1)}`,
          );
          const list =
            bound.length <= 1
              ? bound.join('')
              : `${bound.slice(0, -1).join(', ')} and ${bound.at(-1) ?? ''}`;
          const one = step.bound.length === 1;
          const lines = step.bound.every((b) => b.line === 'row')
            ? one
              ? 'that row is'
              : 'those rows are'
            : step.bound.every((b) => b.line === 'column')
              ? one
                ? 'that column is'
                : 'those columns are'
              : 'those rows and columns are';
          return `As ${list}, ${lines} taken. ${leftText(step.cells)} for ${me}.`;
        }
        return `A person who is bound to one row or column, or a row or column with only one place left, takes cells away. ${leftText(step.cells)} for ${me}.`;
      }
      case 'relations': {
        const named = step.clues.length > 0 ? ` (${quoted(words, step.clues)})` : '';
        return step.people.length > 0
          ? `The clues that tie people together${named} leave ${names(words, step.people)} only one cell, and that cuts the cells of ${me} down. ${leftText(step.cells)}.`
          : `The clues that tie people together${named} cut cells away. ${leftText(step.cells)} for ${me}.`;
      }
      case 'rooms': {
        const extra =
          step.rules.length > 0
            ? `, and the clues about rooms and counting (${quoted(words, step.rules)})`
            : '';
        return `The rules about rooms: exactly one suspect shares a room with the ${words.victim}${extra}. ${leftText(step.cells)} for ${me}.`;
      }
      case 'whatif':
        return `What if: every other cell for ${me} makes a clue break or leaves somebody without a cell. ${leftText(step.cells)}.`;
      case 'result':
        return step.cells.length === 1
          ? `So ${me} belongs at ${words.where(step.cells[0] ?? 0)}.`
          : `So ${me} can only be at ${step.cells.map((cell) => words.where(cell)).join(', ')}.`;
    }
  });
}
