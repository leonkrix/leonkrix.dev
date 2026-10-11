import { Board } from './board';
import { check, type Context, mentions, UNPLACED } from './clues';
import { cluesThatLimit, explain, type ExplainStep } from './explain';
import { deduce, type Deduction } from './propagation';
import { type Cell, type Level } from './types';

/**
 * A hint for the player: which person to look at next, with what to look at, in three stages that
 * get clearer. It is worked out from the people who stand in the right place on the map (the
 * reasoning of the rater, from the clues alone up to what-if), so it is always the next logical
 * step and never needs the solution except to tell who is misplaced.
 */
export interface Hint {
  /** A person is on the map but not where they belong ("mistake"), or the next person to place */
  kind: 'mistake' | 'next';
  person: number;
  /**
   * How far the reasoning has to go to place the person: the clues alone, with the rules about
   * rooms, by trying a cell (what if), or not at all yet (open: the fewest cells that are left).
   */
  by: Deduction['by'];
  /** The cells where the person belongs, or can only be: shown in the third stage */
  cells: Cell[];
  /** The clues to look at: the ones about the person, the ones that limit them, and the ones that the map breaks */
  clues: number[];
  /** Why the person belongs there, step by step (see `explain`) */
  steps: ExplainStep[];
}

export type HintStage = 1 | 2 | 3;

/** The clues that the people placed so far break (a break is final) */
export function brokenClues(level: Level, placed: readonly (Cell | undefined)[]): number[] {
  const board = new Board(level.layout, level.kinds);
  const context: Context = { board, people: level.people, victim: level.people.length - 1 };
  const placement = placed.map((cell) => cell ?? UNPLACED);
  return level.clues.flatMap((clue, index) =>
    check(clue, context, placement) === false ? [index] : [],
  );
}

const ORDER: Readonly<Record<Deduction['by'], number>> = {
  given: 9,
  clues: 0,
  rooms: 1,
  whatif: 2,
  open: 3,
};

/**
 * The next hint for the people on the map, or nothing if everybody stands in the right place.
 * `placed` is the cell of every person (or nothing).
 */
export function findHint(level: Level, placed: readonly (Cell | undefined)[]): Hint | undefined {
  const victim = level.people.length - 1;
  const aboutPerson = (person: number): number[] =>
    level.clues.flatMap((clue, index) => (mentions(clue).includes(person) ? [index] : []));

  const misplaced = placed.findIndex(
    (cell, person) => cell !== undefined && cell !== level.solution[person],
  );
  if (misplaced !== -1) {
    // Where does the person belong, given the people who are right?
    const right = placed.map((cell, person) =>
      cell === level.solution[person] ? cell : undefined,
    );
    const cells = deduce(level, right)?.[misplaced]?.cells ?? [level.solution[misplaced] ?? 0];
    const broken = brokenClues(level, placed);
    return {
      kind: 'mistake',
      person: misplaced,
      by: 'given',
      cells,
      clues: [
        ...new Set([...broken, ...aboutPerson(misplaced), ...cluesThatLimit(level, misplaced)]),
      ],
      steps: explain(level, right, misplaced, broken),
    };
  }

  const deductions = deduce(level, placed);
  if (deductions === undefined) {
    return undefined;
  }
  let best: { person: number; deduction: Deduction } | undefined;
  deductions.forEach((deduction, person) => {
    if (deduction.by === 'given') {
      return;
    }
    const better =
      best === undefined ||
      ORDER[deduction.by] < ORDER[best.deduction.by] ||
      (deduction.by === best.deduction.by &&
        // The suspects first, then the one with the fewest cells left
        (Number(person === victim) < Number(best.person === victim) ||
          (Number(person === victim) === Number(best.person === victim) &&
            deduction.cells.length < best.deduction.cells.length)));
    if (better) {
      best = { person, deduction };
    }
  });
  if (best === undefined) {
    return undefined;
  }
  return {
    kind: 'next',
    person: best.person,
    by: best.deduction.by,
    cells: best.deduction.cells,
    clues: [...new Set([...aboutPerson(best.person), ...cluesThatLimit(level, best.person)])],
    steps: explain(level, placed, best.person),
  };
}

/** What the text of a hint needs to know */
export interface HintWords {
  /** The name of the person of the hint */
  name: string;
  /** What the victim is called ("victim", "failed device") */
  victim: string;
  /** Whether the person of the hint is the victim */
  isVictim: boolean;
}

/** The text of a hint at a stage: first a push, then what to look at, then where. */
export function hintText(hint: Hint, stage: HintStage, words: HintWords): string {
  const { name } = words;
  const where =
    hint.cells.length === 1
      ? `${name} belongs on the marked cell.`
      : `${name} can only be on the marked cells.`;

  if (hint.kind === 'mistake') {
    if (stage === 1) {
      return hint.clues.length > 0
        ? 'One of the people on the map is not where they belong. A clue that is shown in red is a good place to start.'
        : 'One of the people on the map is not where they belong, even if no clue is red yet.';
    }
    if (stage === 2) {
      return `${name} is not in the right place. The marked clues are the ones that mention ${name} or that the map breaks.`;
    }
    return `${name} does not belong where they stand. ${where}`;
  }

  if (stage === 1) {
    switch (hint.by) {
      case 'clues':
        return `Think about ${name} next: the clues and the people on the map are enough to place ${name}.`;
      case 'rooms':
        return `Think about ${name} next: the clues alone do not place ${name}, the rooms matter too.`;
      case 'whatif':
        return `Think about ${name} next. This one is harder: try a cell and see whether a clue breaks.`;
      default:
        return `Nobody can be placed with simple steps now. ${name} has the fewest cells left, so think about ${name}.`;
    }
  }
  if (stage === 2) {
    switch (hint.by) {
      case 'clues':
        return `The marked clues limit where ${name} can be: some name ${name}, some do not (a role, a whole room, a clue about two people). Use them together with the rows and columns that the people on the map have taken.`;
      case 'rooms':
        return words.isVictim || hint.clues.length === 0
          ? `No clue is about ${name}. Think about the rule: exactly one suspect shares a room with the ${words.victim}, and which rows, columns and rooms are still free.`
          : `Read the marked clues first. They leave a few cells; then use the rule that exactly one suspect shares a room with the ${words.victim}.`;
      case 'whatif':
        return `Pick a cell that the marked clues allow for ${name} and follow what it means for the others. If a clue breaks, that cell is wrong.`;
      default:
        return `${name} can only be in a few cells. Look at which of the marked clues cut them down.`;
    }
  }
  return where;
}
