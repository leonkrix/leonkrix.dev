import { describe, expect, it } from 'vitest';

import { createRandom } from '../../shared/random';
import { skins } from '../data/skins';
import { skinWords } from '../data/words';
import { Board } from './board';
import { CLUE_TYPES } from './clues';
import { describeClue } from './describe';
import { enumerateClues, generateLevel } from './generator';
import {
  autoCrossed,
  clearCell,
  culpritOf,
  emptyPlay,
  isCrossedOut,
  isSolved,
  occupantOf,
  placedCount,
  placePerson,
  record,
  redo,
  removeFrom,
  startHistory,
  toggleCross,
  toggleNote,
  undo,
  visibleNotes,
} from './play';
import { kindsOf } from './skin';
import { type Level } from './types';

const made = generateLevel(skins['case-file'], 5, 'medium', 'play-test');
if (made === undefined) {
  throw new Error('no level for the test');
}
const level: Level = made.level;
const board = new Board(level.layout, level.kinds);
const free = (n: number): number => {
  const cells = Array.from({ length: board.cellCount }, (_, cell) => cell).filter(
    (cell) => !board.blocked.has(cell),
  );
  const cell = cells[n];
  if (cell === undefined) {
    throw new Error('not enough free cells');
  }
  return cell;
};

describe('placing people', () => {
  it('starts empty', () => {
    const play = emptyPlay(level);
    expect(placedCount(play)).toBe(0);
    expect(play.placed).toHaveLength(level.people.length);
    expect(isSolved(play, level)).toBe(false);
  });

  it('places a person, moves the person, and takes the person off with the same click', () => {
    let play = emptyPlay(level);
    play = placePerson(play, board, 0, free(0));
    expect(occupantOf(play, free(0))).toBe(0);
    play = placePerson(play, board, 0, free(1));
    expect(occupantOf(play, free(0))).toBeUndefined();
    expect(occupantOf(play, free(1))).toBe(0);
    play = placePerson(play, board, 0, free(1));
    expect(placedCount(play)).toBe(0);
  });

  it('replaces whoever stands on the cell, who is then not placed any more', () => {
    let play = placePerson(emptyPlay(level), board, 0, free(0));
    play = placePerson(play, board, 1, free(0));
    expect(occupantOf(play, free(0))).toBe(1);
    expect(play.placed[0]).toBeUndefined();
  });

  it('does nothing on a blocked cell', () => {
    const blocked = [...board.blocked][0];
    expect(blocked).toBeDefined();
    const play = emptyPlay(level);
    expect(placePerson(play, board, 0, blocked ?? 0)).toBe(play);
    expect(toggleCross(play, board, blocked ?? 0)).toBe(play);
    expect(toggleNote(play, board, blocked ?? 0, 0)).toBe(play);
  });

  it('never changes the value it was given', () => {
    const play = emptyPlay(level);
    const frozen = JSON.stringify(play);
    placePerson(play, board, 0, free(0));
    toggleCross(play, board, free(1));
    toggleNote(play, board, free(2), 0);
    expect(JSON.stringify(play)).toBe(frozen);
  });

  it('recognizes the solution only when everybody is where the solution says', () => {
    let play = emptyPlay(level);
    level.solution.forEach((cell, person) => {
      expect(isSolved(play, level)).toBe(false);
      play = placePerson(play, board, person, cell);
    });
    expect(isSolved(play, level)).toBe(true);
    // One person moved onto the cell of another: no longer solved
    play = placePerson(play, board, 0, level.solution[1] ?? 0);
    expect(isSolved(play, level)).toBe(false);
  });

  it('knows the culprit: the suspect in the room of the victim', () => {
    const culprit = culpritOf(level);
    const victim = level.people.length - 1;
    expect(culprit).toBeLessThan(victim);
    expect(level.layout.roomOf[level.solution[culprit] ?? 0]).toBe(
      level.layout.roomOf[level.solution[victim] ?? 0],
    );
  });
});

describe('crosses and notes', () => {
  it('crosses a cell out and takes the cross away', () => {
    let play = toggleCross(emptyPlay(level), board, free(0));
    expect(play.crossed[free(0)]).toBe(true);
    play = toggleCross(play, board, free(0));
    expect(play.crossed[free(0)]).toBe(false);
  });

  it('does not cross out a cell where somebody stands, and keeps a cross under a person', () => {
    const home = level.solution[0] ?? 0;
    let play = placePerson(emptyPlay(level), board, 0, home);
    expect(toggleCross(play, board, home)).toBe(play);
    // A cell in no row or column of anybody, so that only the player's cross can be on it
    const away =
      Array.from({ length: board.cellCount }, (_, cell) => cell).find(
        (cell) =>
          !board.blocked.has(cell) &&
          board.row(cell) !== board.row(home) &&
          board.col(cell) !== board.col(home),
      ) ?? 0;
    play = toggleCross(play, board, away);
    play = placePerson(play, board, 1, away);
    expect(play.crossed[away]).toBe(true);
    play = placePerson(play, board, 1, away);
    expect(isCrossedOut(play, autoCrossed(play, board), away)).toBe(true);
  });

  it('keeps notes sorted, several per cell, and toggles them', () => {
    let play = emptyPlay(level);
    play = toggleNote(play, board, free(0), 2);
    play = toggleNote(play, board, free(0), 0);
    expect(play.notes[free(0)]).toEqual([0, 2]);
    play = toggleNote(play, board, free(0), 2);
    expect(play.notes[free(0)]).toEqual([0]);
  });

  it('clears a cell: the person first, then the cross, then the notes', () => {
    let play = toggleNote(emptyPlay(level), board, free(0), 1);
    play = clearCell(play, free(0));
    expect(play.notes[free(0)]).toEqual([]);
    play = toggleCross(play, board, free(0));
    play = clearCell(play, free(0));
    expect(play.crossed[free(0)]).toBe(false);
    play = placePerson(play, board, 0, free(0));
    play = clearCell(play, free(0));
    expect(removeFrom(play, free(0))).toBe(play);
    expect(placedCount(play)).toBe(0);
  });
});

describe('placing on cells that a placement crosses out', () => {
  const [home = 0, other = 0] = level.solution;
  const sameLine = Array.from({ length: board.cellCount }, (_, cell) => cell).filter(
    (cell) =>
      cell !== home &&
      cell !== other &&
      !board.blocked.has(cell) &&
      (board.row(cell) === board.row(home) || board.col(cell) === board.col(home)),
  );

  it('is not possible for somebody else, and nothing changes', () => {
    const play = placePerson(emptyPlay(level), board, 0, home);
    expect(sameLine.length).toBeGreaterThan(0);
    for (const cell of sameLine) {
      expect(placePerson(play, board, 1, cell), `cell ${String(cell)}`).toBe(play);
    }
  });

  it('is possible for the person themselves, in their own row and column', () => {
    const play = placePerson(emptyPlay(level), board, 0, home);
    const own = sameLine[0] ?? 0;
    expect(placePerson(play, board, 0, own).placed[0]).toBe(own);
  });

  it('is possible on a cross that the player made, and on a free cell', () => {
    const away =
      Array.from({ length: board.cellCount }, (_, cell) => cell).find(
        (cell) =>
          !board.blocked.has(cell) &&
          board.row(cell) !== board.row(home) &&
          board.col(cell) !== board.col(home),
      ) ?? 0;
    let play = toggleCross(placePerson(emptyPlay(level), board, 0, home), board, away);
    expect(play.crossed[away]).toBe(true);
    play = placePerson(play, board, 1, away);
    expect(play.placed[1]).toBe(away);
    // The cross of the player stays under the person
    expect(play.crossed[away]).toBe(true);
  });
});

describe('crosses that follow from a placement', () => {
  const [first = 0, second = 0] = level.solution;
  const sameLine = (cell: number): number[] =>
    Array.from({ length: board.cellCount }, (_, other) => other).filter(
      (other) =>
        other !== cell &&
        (board.row(other) === board.row(cell) || board.col(other) === board.col(cell)),
    );

  it('crosses out the whole row and column of a person, but not the person or other people', () => {
    const play = placePerson(placePerson(emptyPlay(level), board, 0, first), board, 1, second);
    const auto = autoCrossed(play, board);
    for (const cell of sameLine(first)) {
      if (cell !== second) {
        expect(auto.has(cell), `cell ${String(cell)}`).toBe(true);
      }
    }
    expect(auto.has(first)).toBe(false);
    expect(auto.has(second)).toBe(false);
    // Cells that share no row or column with anybody are not crossed out
    const free = Array.from({ length: board.cellCount }, (_, cell) => cell).filter(
      (cell) => !sameLine(first).includes(cell) && !sameLine(second).includes(cell),
    );
    expect(free.length).toBeGreaterThan(0);
    for (const cell of free) {
      expect(auto.has(cell)).toBe(false);
    }
  });

  it('brings everything back when the person leaves: manual crosses stay, notes return', () => {
    const [noted = 0, manual = 0] = sameLine(first).filter((cell) => !board.blocked.has(cell));
    let play = toggleNote(emptyPlay(level), board, noted, 1);
    play = toggleCross(play, board, manual);
    const before = play;
    play = placePerson(play, board, 0, first);
    // While the person stands there: the notes are hidden, both cells are crossed out
    const auto = autoCrossed(play, board);
    expect(visibleNotes(play, auto, noted)).toEqual([]);
    expect(isCrossedOut(play, auto, noted)).toBe(true);
    expect(isCrossedOut(play, auto, manual)).toBe(true);
    // The person leaves: the notes are back, the cross the player made stays, the others go
    play = placePerson(play, board, 0, first);
    expect(play).toEqual(before);
    const after = autoCrossed(play, board);
    expect(visibleNotes(play, after, noted)).toEqual([1]);
    expect(isCrossedOut(play, after, manual)).toBe(true);
    expect(isCrossedOut(play, after, noted)).toBe(false);
  });

  it('hides the notes of a cell under a cross or a person and shows them again afterwards', () => {
    const cell = sameLine(first).find((other) => !board.blocked.has(other)) ?? 0;
    let play = toggleNote(emptyPlay(level), board, cell, 2);
    expect(visibleNotes(play, autoCrossed(play, board), cell)).toEqual([2]);
    play = toggleCross(play, board, cell);
    expect(visibleNotes(play, autoCrossed(play, board), cell)).toEqual([]);
    play = toggleCross(play, board, cell);
    expect(visibleNotes(play, autoCrossed(play, board), cell)).toEqual([2]);
    play = placePerson(play, board, 3, cell);
    expect(visibleNotes(play, autoCrossed(play, board), cell)).toEqual([]);
    play = placePerson(play, board, 3, cell);
    expect(visibleNotes(play, autoCrossed(play, board), cell)).toEqual([2]);
  });

  it('does not take notes or crosses on a cell that a placement crosses out', () => {
    const play = placePerson(emptyPlay(level), board, 0, first);
    const cell = sameLine(first).find((other) => !board.blocked.has(other)) ?? 0;
    expect(toggleNote(play, board, cell, 1)).toBe(play);
    expect(toggleCross(play, board, cell)).toBe(play);
  });
});

describe('notes about a person who is placed', () => {
  it('are hidden while the person is placed and come back when the person is taken off', () => {
    const [first = 0, second = 0] = level.solution;
    let play = emptyPlay(level);
    // Notes about person 0 and person 1 in a cell that no row or column of the placement touches
    const away =
      Array.from({ length: board.cellCount }, (_, cell) => cell).find(
        (cell) =>
          !board.blocked.has(cell) &&
          board.row(cell) !== board.row(first) &&
          board.col(cell) !== board.col(first) &&
          board.row(cell) !== board.row(second) &&
          board.col(cell) !== board.col(second),
      ) ?? 0;
    play = toggleNote(play, board, away, 0);
    play = toggleNote(play, board, away, 1);
    expect(visibleNotes(play, autoCrossed(play, board), away)).toEqual([0, 1]);
    play = placePerson(play, board, 0, first);
    expect(visibleNotes(play, autoCrossed(play, board), away)).toEqual([1]);
    play = placePerson(play, board, 1, second);
    expect(visibleNotes(play, autoCrossed(play, board), away)).toEqual([]);
    play = placePerson(play, board, 0, first);
    expect(visibleNotes(play, autoCrossed(play, board), away)).toEqual([0]);
    play = placePerson(play, board, 1, second);
    expect(visibleNotes(play, autoCrossed(play, board), away)).toEqual([0, 1]);
  });

  it('cannot be added while the person is placed', () => {
    const play = placePerson(emptyPlay(level), board, 0, level.solution[0] ?? 0);
    const cell = Array.from({ length: board.cellCount }, (_, other) => other).find(
      (other) =>
        !board.blocked.has(other) &&
        board.row(other) !== board.row(level.solution[0] ?? 0) &&
        board.col(other) !== board.col(level.solution[0] ?? 0),
    );
    expect(toggleNote(play, board, cell ?? 0, 0)).toBe(play);
  });
});

describe('undo and redo', () => {
  it('goes back and forth', () => {
    const first = emptyPlay(level);
    const second = placePerson(first, board, 0, level.solution[0] ?? 0);
    const third = placePerson(second, board, 1, level.solution[1] ?? 0);
    expect(third).not.toBe(second);
    let history = record(record(startHistory(first), second), third);
    expect(history.present).toBe(third);
    history = undo(history);
    expect(history.present).toBe(second);
    history = undo(undo(history));
    expect(history.present).toBe(first);
    history = redo(history);
    expect(history.present).toBe(second);
  });

  it('forgets the future after a new action, and ignores actions that change nothing', () => {
    const first = emptyPlay(level);
    const second = placePerson(first, board, 0, free(0));
    let history = undo(record(startHistory(first), second));
    history = record(history, placePerson(first, board, 1, level.solution[1] ?? 0));
    expect(history.future).toHaveLength(0);
    expect(record(history, history.present)).toBe(history);
    expect(undo(startHistory(first)).present).toBe(first);
    expect(redo(startHistory(first)).present).toBe(first);
  });
});

describe('the texts of the clues', () => {
  it('has a clean sentence for every kind of clue, in both skins', () => {
    const seen = new Set<string>();
    for (const skin of Object.values(skins)) {
      for (let seed = 0; seed < 6; seed += 1) {
        const generated = generateLevel(skin, 7, 'hard', `text-${skin.id}-${String(seed)}`);
        if (generated === undefined) {
          continue;
        }
        const { layout, people, solution } = generated.level;
        const kinds = kindsOf(skin);
        const board = new Board(layout, kinds);
        const clues = enumerateClues(
          { board, people, victim: people.length - 1 },
          layout,
          kinds,
          [...solution],
          3,
          createRandom(`text-${skin.id}-${String(seed)}`),
        );
        for (const clue of clues) {
          seen.add(clue.type);
          const text = describeClue(clue, {
            skin,
            words: skinWords[skin.id],
            people,
            layout,
            kinds,
          });
          expect(text, JSON.stringify(clue)).toMatch(/^[A-Za-z][^?]*\.$/);
          expect(text, JSON.stringify(clue)).not.toMatch(/undefined|NaN|\[object|\s{2}|\?/);
          // The victim is never named
          expect(text, JSON.stringify(clue)).not.toContain(people.at(-1)?.name ?? '');
          // A clue names only objects that are on the map
          if (clue.type === 'onFurniture') {
            const present = new Set(layout.objects.map((object) => object.kind));
            for (const [kind, info] of Object.entries(kinds)) {
              const name = skinWords[skin.id].kinds[kind]?.one ?? '';
              expect(text.includes(name), `${kind} in "${text}"`).toBe(
                info.occupiable && present.has(kind),
              );
            }
          }
          // The people of Outage are devices, and the people of Case file are people
          if (skin.id === 'outage') {
            expect(text, JSON.stringify(clue)).not.toMatch(/\b(person|people|nobody)\b/i);
          } else {
            expect(text, JSON.stringify(clue)).not.toMatch(/\bdevices?\b/i);
          }
        }
      }
    }
    expect(CLUE_TYPES.filter((type) => !seen.has(type))).toEqual([]);
  }, 120_000);
});
