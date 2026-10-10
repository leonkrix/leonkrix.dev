import './root-cause.css';

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

import levelsJson from '../data/levels.json';
import { randomStory } from '../data/random-stories';
import { skins } from '../data/skins';
import { STORIES, type Story } from '../data/stories';
import { skinWords } from '../data/words';
import { Board } from '../logic/board';
import { check, type Context, isNeutral, subjectOf, UNPLACED } from '../logic/clues';
import { describeClue, roomText } from '../logic/describe';
import {
  clearCell,
  culpritOf,
  emptyPlay,
  type History,
  isSolved,
  placedCount,
  placePerson,
  type Play,
  record as recordChange,
  redo,
  startHistory,
  toggleCross,
  toggleNote,
  undo,
} from '../logic/play';
import { type RandomSetup } from '../logic/random-level';
import { type Cell } from '../logic/types';
import { type LevelRecord, toLevel } from '../pool';
import { BoardView, ROOM_LETTERS } from './BoardView';
import { ItemLegend } from './Legend';
import { LevelSelect } from './LevelSelect';
import { ClueList, type Mode, Roster, Toolbar } from './Panels';
import { useGenerator } from './useGenerator';

const records = levelsJson as unknown as LevelRecord[];

/** The two pages of the game: the choice of a level, and a level. */
type Screen = { kind: 'select' } | { kind: 'play'; record: LevelRecord };

function firstCell(board: Board): Cell {
  for (let cell = 0; cell < board.cellCount; cell += 1) {
    if (!board.blocked.has(cell)) {
      return cell;
    }
  }
  return 0;
}

/** The title and story of a level: written by hand for the pool, made from templates otherwise */
function storyOf(levelRecord: LevelRecord): Story | undefined {
  const written = STORIES[levelRecord.id];
  if (written !== undefined) {
    return written;
  }
  const victim = levelRecord.people.at(-1);
  return victim === undefined ? undefined : randomStory(levelRecord.skin, levelRecord.seed, victim);
}

/** `?level=hard-3` in the address opens that level of the pool */
function screenFromAddress(random: LevelRecord | undefined): Screen {
  const id = new URLSearchParams(window.location.search).get('level');
  if (id === 'random' && random !== undefined) {
    return { kind: 'play', record: random };
  }
  const found = records.find((entry) => entry.id === id);
  return found === undefined ? { kind: 'select' } : { kind: 'play', record: found };
}

/** The game: choose a level or make a random one, then put the people on the map. */
export default function RootCause() {
  const [screen, setScreen] = useState<Screen>(() => screenFromAddress(undefined));
  const [setup, setSetup] = useState<RandomSetup>({ tier: 'any', size: 'any' });
  const randomRef = useRef<LevelRecord | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef(true);

  const open = (record: LevelRecord): void => {
    const isRandom = !records.some((entry) => entry.id === record.id);
    if (isRandom) {
      randomRef.current = record;
    }
    window.history.pushState(null, '', `?level=${isRandom ? 'random' : record.id}`);
    setScreen({ kind: 'play', record });
  };
  const generator = useGenerator(open);
  const { cancel } = generator;

  const showSelect = (): void => {
    window.history.pushState(null, '', window.location.pathname);
    setScreen({ kind: 'select' });
  };

  // The back button of the browser goes between the two pages
  useEffect(() => {
    const onPop = (): void => {
      cancel();
      setScreen(screenFromAddress(randomRef.current));
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [cancel]);

  // A new page gets the focus on its heading, so that nobody is left on a button that is gone
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    rootRef.current?.querySelector<HTMLElement>('[data-focus-target]')?.focus();
  }, [screen]);

  return (
    <div ref={rootRef}>
      {screen.kind === 'select' ? (
        <LevelSelect
          records={records}
          setup={setup}
          run={generator.run}
          error={generator.error}
          onSetup={setSetup}
          onStart={() => {
            generator.start(setup);
          }}
          onCancel={generator.cancel}
          onPick={(id) => {
            const found = records.find((entry) => entry.id === id);
            if (found !== undefined) {
              open(found);
            }
          }}
        />
      ) : (
        <LevelView
          key={screen.record.id}
          record={screen.record}
          onBack={showSelect}
          onNext={(id) => {
            const found = records.find((entry) => entry.id === id);
            if (found !== undefined) {
              open(found);
            }
          }}
          onAnotherRandom={() => {
            showSelect();
            generator.start(setup);
          }}
        />
      )}
    </div>
  );
}

interface LevelViewProps {
  record: LevelRecord;
  onBack: () => void;
  onNext: (id: string) => void;
  onAnotherRandom: () => void;
}

function LevelView({ record: levelRecord, onBack, onNext, onAnotherRandom }: LevelViewProps) {
  const level = useMemo(() => toLevel(levelRecord), [levelRecord]);
  const skin = skins[levelRecord.skin];
  const words = skinWords[levelRecord.skin];
  const board = useMemo(() => new Board(level.layout, level.kinds), [level]);
  const story = storyOf(levelRecord);
  const isRandom = !records.some((entry) => entry.id === levelRecord.id);

  const [history, setHistory] = useState<History<Play>>(() => startHistory(emptyPlay(level)));
  const [mode, setMode] = useState<Mode>('place');
  const [selected, setSelected] = useState<number | undefined>(0);
  const [cursor, setCursor] = useState<Cell>(() => firstCell(board));
  const [announcement, setAnnouncement] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const play = history.present;

  const solved = isSolved(play, level);
  const culprit = solved ? culpritOf(level) : undefined;
  const victim = level.people.length - 1;

  const roomName = (room: number): string => level.layout.rooms[room]?.name ?? '';
  // All rooms of one type share a color, so that a color means a kind of room
  const colorOf = (room: number): number =>
    Math.max(
      0,
      skin.roomTypes.findIndex((type) => type.id === level.layout.rooms[room]?.type),
    );

  const describeContext = useMemo(
    () => ({ skin, words, people: level.people, layout: level.layout, kinds: level.kinds }),
    [skin, words, level],
  );
  const clues = useMemo(() => {
    const items = level.clues.map((clue, index) => ({
      index,
      text: describeClue(clue, describeContext),
      subject: subjectOf(clue),
    }));
    // The clues about the whole map first, then the suspects in order
    return items.sort((a, b) => (a.subject ?? -1) - (b.subject ?? -1) || a.index - b.index);
  }, [level, describeContext]);

  // A clue is ticked while the people placed so far satisfy it, and red while they break it
  // (a "false" of the check is final, however the rest is placed)
  const verdicts = useMemo(() => {
    const context: Context = { board, people: level.people, victim };
    const placement = play.placed.map((cell) => cell ?? UNPLACED);
    const answers = level.clues.map((clue) => check(clue, context, placement));
    const indexes = (wanted: boolean): Set<number> =>
      new Set(answers.flatMap((answer, index) => (answer === wanted ? [index] : [])));
    return { fulfilled: indexes(true), contradicted: indexes(false) };
  }, [board, level, play, victim]);

  const change = (next: Play): void => {
    setHistory((current) => recordChange(current, next));
  };

  const say = (text: string): void => {
    setAnnouncement(text);
  };

  // A click that is refused is said aloud and shown: the cell shakes for a moment
  const [refused, setRefused] = useState<Cell | undefined>();
  const refusedTimerRef = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(refusedTimerRef.current);
    },
    [],
  );
  const refuse = (cell: Cell, text: string): void => {
    say(text);
    setRefused(undefined);
    window.clearTimeout(refusedTimerRef.current);
    // One frame without the mark, so that the shake starts again on a second click
    refusedTimerRef.current = window.setTimeout(() => {
      setRefused(cell);
      refusedTimerRef.current = window.setTimeout(() => {
        setRefused(undefined);
      }, 450);
    }, 20);
  };

  const where = (cell: Cell): string =>
    `row ${String(board.row(cell) + 1)}, column ${String(board.col(cell) + 1)}`;

  const choosePerson = (person: number): void => {
    setSelected(person);
    // A person is chosen to be placed or noted: out of the cross mode
    if (mode === 'cross') {
      setMode('place');
    }
  };

  const activate = (cell: Cell): void => {
    if (solved) {
      return;
    }
    if (board.blocked.has(cell)) {
      refuse(cell, 'Nobody can stand on an object that blocks the cell.');
      return;
    }
    if (mode === 'cross') {
      const next = toggleCross(play, board, cell);
      if (next === play) {
        refuse(cell, 'That cell is crossed out because somebody stands in its row or column.');
      }
      change(next);
      return;
    }
    const person = selected;
    if (person === undefined) {
      const there = play.placed.indexOf(cell);
      if (there !== -1) {
        choosePerson(there);
      } else {
        say('Choose a person first.');
      }
      return;
    }
    const name = level.people[person]?.name ?? '';
    if (mode === 'place') {
      const next = placePerson(play, board, person, cell);
      change(next);
      if (next.placed[person] === cell) {
        say(`${name} placed at ${where(cell)}`);
      } else if (next !== play) {
        say(`${name} taken off the map`);
      } else {
        refuse(cell, 'That cell is crossed out because somebody stands in its row or column.');
      }
    } else {
      const next = toggleNote(play, board, cell, person);
      if (next === play) {
        refuse(cell, 'Notes cannot go on a cell that is crossed out or taken.');
      }
      change(next);
    }
  };

  const move = (delta: number, rowDelta: number): void => {
    const row = Math.min(board.size - 1, Math.max(0, board.row(cursor) + rowDelta));
    const col = Math.min(board.size - 1, Math.max(0, board.col(cursor) + delta));
    setCursor(board.cellAt(row, col));
  };

  // Moving the cursor with the keys moves the focus with it
  useEffect(() => {
    const target = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${String(cursor)}"]`);
    if (
      target !== null &&
      target !== undefined &&
      gridRef.current?.contains(document.activeElement)
    ) {
      target.focus();
    }
  }, [cursor]);

  // When the level is solved, the result gets the focus
  useEffect(() => {
    if (solved) {
      resultRef.current?.focus();
    }
  }, [solved]);

  const reset = (): void => {
    change(emptyPlay(level));
    say('Everything taken off the map');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const target = event.target as HTMLElement;
    // Typing in a field or working in the legend is not a move on the map
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.closest('dialog') !== null
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
      event.preventDefault();
      if (key === 'y' || event.shiftKey) {
        setHistory(redo);
      } else {
        setHistory(undo);
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const inGrid = gridRef.current?.contains(target) === true;
    switch (key) {
      case 'arrowup':
        if (inGrid) {
          event.preventDefault();
          move(0, -1);
        }
        return;
      case 'arrowdown':
        if (inGrid) {
          event.preventDefault();
          move(0, 1);
        }
        return;
      case 'arrowleft':
        if (inGrid) {
          event.preventDefault();
          move(-1, 0);
        }
        return;
      case 'arrowright':
        if (inGrid) {
          event.preventDefault();
          move(1, 0);
        }
        return;
      case 'backspace':
      case 'delete':
        if (inGrid && !solved) {
          event.preventDefault();
          change(clearCell(play, cursor));
        }
        return;
      case 'escape':
        setSelected(undefined);
        return;
      case 'p':
        setMode('place');
        return;
      case 'n':
        setMode('note');
        return;
      case 'x':
        setMode('cross');
        return;
      default:
        break;
    }
    const digit = Number(key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= level.people.length) {
      choosePerson(digit - 1);
    }
  };

  const levelIndex = records.findIndex((entry) => entry.id === levelRecord.id);
  const nextRecord = isRandom ? undefined : records[levelIndex + 1];
  const culpritPerson = culprit === undefined ? undefined : level.people[culprit];
  const crimeRoom = board.roomOf[level.solution[victim] ?? 0] ?? 0;

  return (
    // The keys of everything inside (map, people, buttons) bubble up to this one handler
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div className="rc" role="group" aria-label="Root Cause" onKeyDown={onKeyDown}>
      <header className="rc-head">
        <div>
          <p className="rc-eyebrow">
            <span className="capitalize">{levelRecord.tier}</span> · {String(levelRecord.size)}×
            {String(levelRecord.size)} · {skin.id === 'case-file' ? 'Case file' : 'Outage'}
          </p>
          <h2 className="rc-title" tabIndex={-1} data-focus-target>
            {story?.title ?? levelRecord.id}
          </h2>
        </div>
        <button type="button" className="rc-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Level selection
        </button>
        <p className="rc-story">{story?.story}</p>
      </header>

      <div className="rc-layout">
        <section className="rc-map" aria-label="Map">
          <div ref={gridRef}>
            <BoardView
              level={level}
              board={board}
              play={play}
              cursor={cursor}
              selected={selected}
              culprit={culprit}
              refused={refused}
              roomName={roomName}
              colorOf={colorOf}
              onActivate={activate}
              onCursor={setCursor}
            />
          </div>
          <ul className="rc-legend" aria-label="Rooms">
            {Array.from({ length: board.roomCount }, (_, room) => (
              <li
                key={room}
                data-room-color={colorOf(room)}
                data-crime={(solved && room === crimeRoom) || undefined}
              >
                <span className="rc-legend-letter" aria-hidden="true">
                  {ROOM_LETTERS[room]}
                </span>
                {roomName(room)}
              </li>
            ))}
          </ul>
        </section>

        <section className="rc-people" aria-label="People">
          <Roster
            people={level.people}
            play={play}
            selected={selected}
            words={words}
            onSelect={choosePerson}
          />
          <p className="rc-count" aria-live="off">
            {String(placedCount(play))} of {String(level.people.length)} placed
          </p>
          <Toolbar
            mode={mode}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onMode={setMode}
            onUndo={() => {
              setHistory(undo);
            }}
            onRedo={() => {
              setHistory(redo);
            }}
            onReset={reset}
          >
            <ItemLegend level={level} words={words} />
          </Toolbar>
        </section>

        <section className="rc-clue-panel" aria-label="Clues">
          <h3 className="rc-section-title">Clues</h3>
          <ClueList
            items={clues}
            fulfilled={verdicts.fulfilled}
            contradicted={verdicts.contradicted}
          />
          <p className="rc-rule">
            Exactly one suspect shares a room with the {words.victim}: the {words.culprit}. A clue
            is ticked while the people on the map satisfy it, and red while they break it.
            {level.clues.some(isNeutral) &&
              ` Clues about the whole map count everybody, the ${words.victim} too.`}
          </p>
        </section>
      </div>

      {/* One box with a fixed height, so that the result does not push the panels below it down */}
      <div className="rc-status" data-solved={solved || undefined}>
        {solved && culpritPerson !== undefined ? (
          <div className="rc-result" ref={resultRef} tabIndex={-1}>
            <p className="rc-stamp">{words.solved}</p>
            <p className="rc-result-text">
              <strong>{culpritPerson.name}</strong> was the {words.culprit}: alone with{' '}
              <strong>{level.people[victim]?.name}</strong> in {roomText(level.layout, crimeRoom)}.
            </p>
            <div className="rc-result-actions">
              {nextRecord !== undefined && (
                <button
                  type="button"
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
                  onClick={() => {
                    onNext(nextRecord.id);
                  }}
                >
                  Next level
                </button>
              )}
              {isRandom && (
                <button
                  type="button"
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
                  onClick={onAnotherRandom}
                >
                  Another random level
                </button>
              )}
              <button
                type="button"
                className="btn-outline rounded-lg px-4 py-2 text-sm text-fg"
                onClick={reset}
              >
                Play again
              </button>
            </div>
          </div>
        ) : (
          <p className="rc-status-hint">
            The case is solved when everybody stands in the right place, the {words.victim}{' '}
            included. Until then there is no feedback, except the ticks and the red marks on the
            clues.
          </p>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {solved ? `${words.solved}.` : announcement}
      </p>
    </div>
  );
}
