import { type CSSProperties, useMemo } from 'react';

import { type Board, SIDES } from '../logic/board';
import { autoCrossed, isCrossedOut, occupantOf, type Play, visibleNotes } from '../logic/play';
import { type Cell, type Level, type Side } from '../logic/types';
import { Glyph } from './Glyph';

/** Letters that mark the rooms: the colors alone must not tell them apart */
export const ROOM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface BoardViewProps {
  level: Level;
  board: Board;
  play: Play;
  cursor: Cell;
  selected: number | undefined;
  /** The suspect to point out once the level is solved */
  culprit: number | undefined;
  /** A cell that refused a click a moment ago: it shakes */
  refused: Cell | undefined;
  roomName: (room: number) => string;
  /** The color number of a room: all rooms of one type share a color */
  colorOf: (room: number) => number;
  onActivate: (cell: Cell) => void;
  onCursor: (cell: Cell) => void;
}

const SIDE_NAMES: Readonly<Record<Side, string>> = {
  n: 'above',
  e: 'right',
  s: 'below',
  w: 'left',
};

/** The board: a grid of cells with room colors, walls, windows, objects, people, notes and crosses. */
export function BoardView({
  level,
  board,
  play,
  cursor,
  selected,
  culprit,
  refused,
  roomName,
  colorOf,
  onActivate,
  onCursor,
}: BoardViewProps) {
  const { size } = board;
  const auto = useMemo(() => autoCrossed(play, board), [play, board]);
  const victim = level.people.length - 1;
  const victimCell = level.solution[victim];
  const crimeRoom = culprit === undefined ? undefined : board.roomOf[victimCell ?? 0];

  // The first cell of every room carries its letter; objects that cover two cells are joined
  const letterCell = useMemo(
    () => new Set(board.roomCells.map((cells) => Math.min(...cells))),
    [board],
  );
  const joins = useMemo(() => {
    const result = new Map<Cell, Partial<Record<Side, boolean>>>();
    for (const object of level.layout.objects) {
      if (object.cells.length !== 2) {
        continue;
      }
      const [first = 0, second = 0] = object.cells;
      for (const side of SIDES) {
        if (board.step(first, side) === second) {
          result.set(first, { ...result.get(first), [side]: true });
          const back = { n: 's', s: 'n', e: 'w', w: 'e' } as const;
          result.set(second, { ...result.get(second), [back[side]]: true });
        }
      }
    }
    return result;
  }, [board, level.layout.objects]);
  const windows = useMemo(() => {
    const result = new Map<Cell, Side[]>();
    for (const { cell, side } of level.layout.windows) {
      result.set(cell, [...(result.get(cell) ?? []), side]);
    }
    return result;
  }, [level.layout.windows]);

  const rows = Array.from({ length: size }, (_, row) => row);

  return (
    <div
      className="rc-board"
      role="grid"
      aria-label={`Map of ${String(size)} by ${String(size)} cells`}
      aria-rowcount={size}
      aria-colcount={size}
      style={{ '--n': size } as CSSProperties}
    >
      {rows.map((row) => (
        <div key={row} role="row" className="rc-row">
          {rows.map((col) => {
            const cell = board.cellAt(row, col);
            const room = board.roomOf[cell] ?? 0;
            const occupant = occupantOf(play, cell);
            const blocked = board.blocked.has(cell);
            const kind = board.kindAt[cell];
            // Once the level is solved the map is left clean: no crosses
            const crossed =
              culprit === undefined &&
              !blocked &&
              occupant === undefined &&
              isCrossedOut(play, auto, cell);
            const notes = visibleNotes(play, auto, cell);
            const walls = SIDES.filter((side) => {
              const next = board.step(cell, side);
              return next !== undefined && board.roomOf[next] !== room;
            });
            const isCursor = cell === cursor;
            const cursorRow = board.row(cursor);
            const cursorCol = board.col(cursor);

            const parts = [
              `Row ${String(row + 1)}, column ${String(col + 1)}`,
              roomName(room),
              kind === undefined ? undefined : blocked ? `${kind} (nobody can stand here)` : kind,
              ...(windows.get(cell) ?? []).map((side) => `window ${SIDE_NAMES[side]}`),
              occupant === undefined
                ? undefined
                : `${level.people[occupant]?.name ?? ''} is here${occupant === victim ? ' (victim)' : ''}`,
              crossed ? 'crossed out' : undefined,
              notes.length > 0
                ? `notes: ${notes.map((person) => level.people[person]?.name ?? '').join(', ')}`
                : undefined,
            ].filter((part): part is string => part !== undefined);

            return (
              <div
                key={cell}
                role="gridcell"
                tabIndex={isCursor ? 0 : -1}
                aria-label={parts.join('. ')}
                aria-colindex={col + 1}
                data-cell={cell}
                className="rc-cell"
                data-room-color={colorOf(room)}
                data-blocked={blocked || undefined}
                data-crossed={crossed || undefined}
                data-same-line={
                  !isCursor && (row === cursorRow || col === cursorCol) ? true : undefined
                }
                data-cursor={isCursor || undefined}
                data-refused={cell === refused || undefined}
                data-crime={crimeRoom === room ? true : undefined}
                data-wall={walls.join(' ') || undefined}
                onClick={() => {
                  onCursor(cell);
                  onActivate(cell);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onActivate(cell);
                  }
                }}
                onFocus={() => {
                  if (!isCursor) {
                    onCursor(cell);
                  }
                }}
              >
                {letterCell.has(cell) && (
                  <span className="rc-room-letter" aria-hidden="true">
                    {ROOM_LETTERS[room]}
                  </span>
                )}
                {(windows.get(cell) ?? []).map((side) => (
                  <span key={side} className="rc-window" data-side={side} aria-hidden="true" />
                ))}
                {kind !== undefined && (
                  <Glyph kind={kind} occupiable={!blocked} join={joins.get(cell) ?? {}} />
                )}
                {crossed && (
                  <svg className="rc-cross" viewBox="0 0 100 100" aria-hidden="true">
                    <line x1="24" y1="24" x2="76" y2="76" />
                    <line x1="76" y1="24" x2="24" y2="76" />
                  </svg>
                )}
                {notes.length > 0 && (
                  <span className="rc-notes" aria-hidden="true">
                    {notes.map((person) => (
                      <span key={person} data-selected={person === selected || undefined}>
                        {level.people[person]?.label}
                      </span>
                    ))}
                  </span>
                )}
                {occupant !== undefined && (
                  <span
                    className="rc-token"
                    data-victim={occupant === victim || undefined}
                    data-selected={occupant === selected || undefined}
                    data-culprit={occupant === culprit || undefined}
                    data-long={(level.people[occupant]?.label.length ?? 0) > 2 || undefined}
                    aria-hidden="true"
                  >
                    {level.people[occupant]?.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
