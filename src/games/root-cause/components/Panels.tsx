import { type ReactNode } from 'react';

import { type SkinWords } from '../data/words';
import { type Play } from '../logic/play';
import { type Person } from '../logic/types';
import { capitalize, roleLabel } from './text';

export type Mode = 'place' | 'note' | 'cross';

export const MODES: readonly { id: Mode; label: string; key: string; hint: string }[] = [
  { id: 'place', label: 'Place', key: 'P', hint: 'Put the chosen person on a cell' },
  { id: 'note', label: 'Note', key: 'N', hint: 'Mark cells where the chosen person could be' },
  { id: 'cross', label: 'Cross', key: 'X', hint: 'Cross out cells where nobody stands' },
];

interface RosterProps {
  people: readonly Person[];
  play: Play;
  selected: number | undefined;
  words: SkinWords;
  onSelect: (person: number) => void;
}

/** The people of the level: choose one, then click a cell. The victim is the last one. */
export function Roster({ people, play, selected, words, onSelect }: RosterProps) {
  const victim = people.length - 1;
  return (
    <ul className="rc-roster" aria-label="People">
      {people.map((person, index) => (
        <li key={person.name}>
          <button
            type="button"
            className="rc-person"
            aria-pressed={index === selected}
            data-victim={index === victim || undefined}
            data-placed={play.placed[index] !== undefined || undefined}
            onClick={() => {
              onSelect(index);
            }}
            title={`${person.name}${index === victim ? ` (the ${words.victim})` : ''}, key ${String(index + 1)}`}
          >
            <span className="rc-person-token" aria-hidden="true">
              {person.label}
            </span>
            <span className="rc-person-text">
              <span className="rc-person-name">{person.name}</span>
              <span className="rc-person-role">
                {index === victim ? capitalize(words.victim) : roleLabel(words, person.role)}
                {play.placed[index] !== undefined && <span className="sr-only"> (placed)</span>}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface ModesProps {
  mode: Mode;
  canUndo: boolean;
  canRedo: boolean;
  onMode: (mode: Mode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  /** More tools for the second row (the legend) */
  children?: ReactNode;
}

/** Small line drawings for the tools (the paths are those of the Lucide icons used on the site) */
function ToolIcon({ name }: { name: 'undo' | 'redo' | 'clear' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'undo' && (
        <>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" />
        </>
      )}
      {name === 'redo' && (
        <>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" />
        </>
      )}
      {name === 'clear' && (
        <>
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <path d="M10 11v6M14 11v6" />
        </>
      )}
    </svg>
  );
}

/** Place, note or cross in the first row; undo, redo, clear and the legend in the second. */
export function Toolbar({
  mode,
  canUndo,
  canRedo,
  onMode,
  onUndo,
  onRedo,
  onReset,
  children,
}: ModesProps) {
  return (
    <div className="rc-toolbar">
      <div className="rc-modes" role="group" aria-label="What a click does">
        {MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={mode === entry.id}
            title={`${entry.hint} (key ${entry.key})`}
            onClick={() => {
              onMode(entry.id);
            }}
          >
            {entry.label}
            <kbd aria-hidden="true">{entry.key}</kbd>
          </button>
        ))}
      </div>
      <div className="rc-tools" role="group" aria-label="Undo, redo, clear and legend">
        <button type="button" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)">
          <ToolIcon name="undo" />
          <span className="sr-only">Undo</span>
        </button>
        <button type="button" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Y)">
          <ToolIcon name="redo" />
          <span className="sr-only">Redo</span>
        </button>
        <button type="button" onClick={onReset} title="Take everything off the map">
          <ToolIcon name="clear" />
          <span className="sr-only">Clear the map</span>
        </button>
        {children}
      </div>
    </div>
  );
}

interface CluesProps {
  items: readonly { index: number; text: string }[];
  /** The clues that the people on the map satisfy right now */
  fulfilled: ReadonlySet<number>;
  /** The clues that the people on the map break (a break is final, however the rest is placed) */
  contradicted: ReadonlySet<number>;
}

/**
 * The clues in reading order: the ones about the whole map first, then one group per suspect. A
 * clue is ticked while the people placed so far satisfy it (and moves to the end of the list),
 * and shown in red while a placement breaks it. Both go away when the people are moved.
 */
export function ClueList({ items, fulfilled, contradicted }: CluesProps) {
  // Satisfied clues go to the end of the list, so that the open ones stay together at the top.
  // Both groups keep the reading order.
  const ordered = [
    ...items.filter((item) => !fulfilled.has(item.index)),
    ...items.filter((item) => fulfilled.has(item.index)),
  ];
  return (
    <ol className="rc-clues">
      {ordered.map((item) => {
        const done = fulfilled.has(item.index);
        const wrong = contradicted.has(item.index);
        return (
          <li key={item.index} data-done={done || undefined} data-wrong={wrong || undefined}>
            <span className="rc-clue-mark" aria-hidden="true">
              {done ? '✓' : wrong ? '✕' : ''}
            </span>
            <span className="rc-clue-text">
              {item.text}
              {done && <span className="sr-only"> (satisfied by the people on the map)</span>}
              {wrong && <span className="sr-only"> (broken by the people on the map)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
