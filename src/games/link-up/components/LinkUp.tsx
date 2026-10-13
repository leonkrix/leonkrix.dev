import {
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { createRandom, freshSeed } from '../../shared/random';
import { firstGame } from '../logic/first-game';
import {
  deselectAll,
  type Game,
  judge,
  MAX_MISTAKES,
  missingGroups,
  type Outcome,
  revealNext,
  shuffle,
  submit,
  toggle,
} from '../logic/game';
import { buildPuzzleUrl } from '../logic/link';
import { newGame } from '../logic/new-game';
import { GROUP_SIZE } from '../logic/puzzle';
import LinkUpSkeleton from './LinkUpSkeleton';

/** How long each reaction takes, in milliseconds (the CSS animations have the same lengths) */
const DELAY_BEFORE_CHECK = 240;
const CORRECT_MS = 760;
const WRONG_MS = 620;
const REVEAL_FIRST_MS = 900;
const REVEAL_STEP_MS = 950;
const TOAST_MS = 1800;
const COLUMNS = 4;

/** What a screen reader hears after a group was handed in. */
function describeOutcome(game: Game, outcome: Outcome, mistakesLeft: number): string {
  switch (outcome.kind) {
    case 'correct': {
      const group = game.puzzle.groups[outcome.group];
      return `Group found: ${group?.name ?? ''}. ${group?.terms.map((term) => term.name).join(', ') ?? ''}.`;
    }
    case 'oneAway':
      return `One away. ${String(mistakesLeft)} ${mistakesLeft === 1 ? 'mistake' : 'mistakes'} left.`;
    case 'repeat':
      return 'You tried that group already. It does not cost a mistake.';
    case 'wrong':
      return `Not a group. ${String(mistakesLeft)} ${mistakesLeft === 1 ? 'mistake' : 'mistakes'} left.`;
  }
}

/**
 * Moves the tiles to their new places with a short slide (FLIP: the new place is measured, the tile
 * is put back where it was, and then it glides). Tiles that stay put do not move at all. Skipped
 * with reduced motion.
 */
function useSlide(container: RefObject<HTMLElement | null>, key: string): void {
  const previousRef = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const element = container.current;
    if (element === null) {
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, DOMRect>();
    for (const tile of element.querySelectorAll<HTMLElement>('[data-slide]')) {
      const id = tile.dataset.slide ?? '';
      const box = tile.getBoundingClientRect();
      next.set(id, box);
      const before = previousRef.current.get(id);
      if (before !== undefined && !reduced) {
        const dx = before.left - box.left;
        const dy = before.top - box.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          tile.animate(
            [{ transform: `translate(${String(dx)}px, ${String(dy)}px)` }, { transform: 'none' }],
            { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
          );
        }
      }
    }
    previousRef.current = next;
  }, [container, key]);
}

/** The game itself, once the first puzzle is ready. */
function LinkUpBoard({ initialSeed, initialGame }: { initialSeed: number; initialGame: Game }) {
  const [seed, setSeed] = useState<number>(initialSeed);
  const [game, setGame] = useState<Game>(initialGame);
  // True while the files for a new puzzle are being fetched
  const [starting, setStarting] = useState(false);
  // Whether the definitions are readable (off blurs them, for a harder game). Nothing is stored.
  const [showDefinitions, setShowDefinitions] = useState(true);
  // The reaction that is playing right now: it blocks the board until it is over
  const [reaction, setReaction] = useState<{
    kind: Outcome['kind'];
    ids: readonly string[];
    color: number;
  } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string>('');
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [round, setRound] = useState(0);
  // The tiles of a new puzzle come in one after the other; afterwards this is switched off again
  const [fresh, setFresh] = useState(true);
  const boardRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef(new Map<string, HTMLButtonElement>());
  const timersRef = useRef<number[]>([]);
  const toastCountRef = useRef(0);

  const later = (action: () => void, milliseconds: number): void => {
    timersRef.current.push(window.setTimeout(action, milliseconds));
  };
  useEffect(
    () => () => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  useEffect(() => {
    if (!fresh) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setFresh(false);
    }, 1400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [fresh, round]);

  const flash = (text: string): void => {
    toastCountRef.current += 1;
    setToast({ text, id: toastCountRef.current });
  };
  useEffect(() => {
    if (toast === null) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, TOAST_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const revealing = game.status === 'lost' && missingGroups(game).length > 0;
  const busy = reaction !== null || revealing;
  const mistakesLeft = MAX_MISTAKES - game.mistakes;
  const found = [...game.solved, ...game.revealed];

  // Slide the tiles that are left to their new places whenever the order or the board changes
  useSlide(boardRef, `${String(round)}|${game.order.join('|')}|${String(found.length)}`);

  // The fourth tile hands the group in by itself, a moment after it was picked
  useEffect(() => {
    if (game.status !== 'playing' || reaction !== null || game.selected.length !== GROUP_SIZE) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const outcome = judge(game);
      if (outcome === null) {
        return;
      }
      const next = submit(game);
      const ids = game.selected;
      const color = game.solved.length;
      setReaction({ kind: outcome.kind, ids, color });
      const duration = outcome.kind === 'correct' ? CORRECT_MS : WRONG_MS;
      later(() => {
        setReaction(null);
        setGame(next);
        const text = describeOutcome(next, outcome, MAX_MISTAKES - next.mistakes);
        setAnnouncement(
          next.status === 'won'
            ? `${text} You solved the puzzle with ${String(next.mistakes)} ${next.mistakes === 1 ? 'mistake' : 'mistakes'}.`
            : next.status === 'lost'
              ? `${text} Out of tries. The missing groups are shown.`
              : text,
        );
        if (outcome.kind === 'oneAway') {
          flash('One away!');
        } else if (outcome.kind === 'repeat') {
          flash('You tried that already');
        }
      }, duration);
    }, DELAY_BEFORE_CHECK);
    return () => {
      window.clearTimeout(timer);
    };
    // The timers of `later` are cleaned up when the component goes away
  }, [game, reaction]);

  // After the last mistake the missing groups are shown one after the other
  useEffect(() => {
    if (!revealing || reaction !== null) {
      return undefined;
    }
    const timer = window.setTimeout(
      () => {
        setGame((current) => revealNext(current));
      },
      game.revealed.length === 0 ? REVEAL_FIRST_MS : REVEAL_STEP_MS,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [revealing, reaction, game.revealed.length]);

  // The result gets the focus when the game is over (and the missing groups have been shown)
  const over = game.status !== 'playing' && !revealing;
  useEffect(() => {
    if (over) {
      resultRef.current?.focus({ preventScroll: true });
    }
  }, [over]);

  // The tile that can be reached with the Tab key: the one that had the focus, or the first one
  const tabId = game.order.includes(focusId) ? focusId : (game.order[0] ?? '');
  // When the focused tile leaves the board (a group was found), the focus goes to the first tile
  // instead of getting lost
  useEffect(() => {
    const active = document.activeElement;
    const lost = active === document.body || boardRef.current?.contains(active) === true;
    if (
      game.status === 'playing' &&
      lost &&
      focusId !== '' &&
      !game.order.includes(focusId) &&
      tabId !== ''
    ) {
      window.requestAnimationFrame(() => {
        tilesRef.current.get(tabId)?.focus({ preventScroll: true });
      });
    }
  }, [game.order, game.status, focusId, tabId]);

  const pick = (id: string): void => {
    if (busy || game.status !== 'playing') {
      return;
    }
    setInfo(id);
    setGame((current) => toggle(current, id));
  };

  const restart = (): void => {
    if (starting) {
      return;
    }
    setStarting(true);
    const next = freshSeed();
    newGame(next).then(
      (nextGame) => {
        for (const timer of timersRef.current) {
          window.clearTimeout(timer);
        }
        timersRef.current = [];
        setSeed(next);
        setGame(nextGame);
        setReaction(null);
        setInfo(null);
        setToast(null);
        setRound((count) => count + 1);
        setFresh(true);
        setAnnouncement('New puzzle: sixteen terms, four groups.');
        setStarting(false);
      },
      () => {
        setStarting(false);
        flash('The new puzzle could not be loaded');
      },
    );
  };

  const copyLink = (): void => {
    const url = buildPuzzleUrl(`${window.location.origin}${window.location.pathname}`, seed);
    navigator.clipboard.writeText(url).then(
      () => {
        flash('Link to this puzzle copied');
      },
      () => {
        flash('Copying was not possible');
      },
    );
  };

  const move = (to: number): void => {
    const id = game.order[Math.max(0, Math.min(game.order.length - 1, to))];
    if (id !== undefined) {
      tilesRef.current.get(id)?.focus();
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = game.order.indexOf(tabId);
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + COLUMNS,
      ArrowUp: index - COLUMNS,
      Home: 0,
      End: game.order.length - 1,
    };
    const target = keys[event.key];
    if (target !== undefined) {
      event.preventDefault();
      move(target);
    } else if (event.key === 'Escape' && !busy) {
      setGame((current) => deselectAll(current));
    }
  };

  const infoTile = game.puzzle.tiles.find((tile) => tile.id === info);
  const won = game.status === 'won';

  return (
    <div className="lu" data-won={won || undefined} data-fresh={fresh || undefined} key={round}>
      <div className="lu-bar">
        <div
          className="lu-mistakes"
          role="img"
          aria-label={`${String(mistakesLeft)} mistakes left`}
        >
          <span className="lu-mistakes-label" aria-hidden="true">
            Mistakes left
          </span>
          {Array.from({ length: MAX_MISTAKES }, (_, index) => (
            <span
              key={index}
              className="lu-dot"
              data-lost={index >= mistakesLeft || undefined}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="lu-actions">
          <button
            type="button"
            disabled={busy || game.status !== 'playing'}
            onClick={() => {
              setGame((current) => shuffle(current, createRandom(freshSeed())));
            }}
          >
            Shuffle
          </button>
          <button
            type="button"
            disabled={busy || game.status !== 'playing' || game.selected.length === 0}
            onClick={() => {
              setGame((current) => deselectAll(current));
            }}
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="lu-toast" aria-hidden="true">
        {toast !== null && (
          <span key={toast.id} className="lu-toast-text">
            {toast.text}
          </span>
        )}
      </div>

      <div className="lu-board" ref={boardRef} data-layout-fluid>
        {found.map((group, index) => {
          const data = game.puzzle.groups[group];
          if (data === undefined) {
            return null;
          }
          const missed = index >= game.solved.length;
          return (
            <section
              key={group}
              className="lu-found"
              data-color={index}
              data-missed={missed || undefined}
              data-step={index}
              aria-label={`${data.name}${missed ? ' (not found)' : ''}`}
            >
              <h2>{data.name}</h2>
              <p className="lu-found-terms">
                {data.terms.map((term, position) => (
                  <button
                    key={term.name}
                    type="button"
                    className="lu-chip"
                    onMouseEnter={() => {
                      setInfo(term.name);
                    }}
                    onFocus={() => {
                      setInfo(term.name);
                    }}
                  >
                    {term.name}
                    {position < data.terms.length - 1 ? ',' : ''}
                  </button>
                ))}
              </p>
            </section>
          );
        })}

        {/* When all groups are shown, the grid is gone (an empty one would still add a gap) */}
        {game.order.length > 0 && (
          <>
            {/* The arrow keys move between the tiles (every tile is a button itself) */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
              className="lu-grid"
              role="group"
              aria-label="Terms, pick four that belong together"
              onKeyDown={onKeyDown}
            >
              {game.order.map((id, index) => {
                const tile = game.puzzle.tiles.find((entry) => entry.id === id);
                const picked = game.selected.includes(id);
                const reacting = reaction?.ids.includes(id) === true;
                return (
                  <button
                    key={id}
                    ref={(element) => {
                      if (element === null) {
                        tilesRef.current.delete(id);
                      } else {
                        tilesRef.current.set(id, element);
                      }
                    }}
                    type="button"
                    className="lu-tile"
                    data-slide={id}
                    data-picked={picked || undefined}
                    data-react={reacting ? reaction.kind : undefined}
                    data-color={
                      reacting && reaction.kind === 'correct' ? reaction.color : undefined
                    }
                    aria-pressed={picked}
                    aria-describedby="lu-info"
                    tabIndex={id === tabId ? 0 : -1}
                    disabled={game.status !== 'playing'}
                    style={{ '--i': index } as CSSProperties}
                    onClick={() => {
                      pick(id);
                    }}
                    onFocus={() => {
                      setFocusId(id);
                      setInfo(id);
                    }}
                    onMouseEnter={() => {
                      setInfo(id);
                    }}
                  >
                    {tile?.name ?? id}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="lu-info">
        <p id="lu-info">
          {infoTile === undefined ? (
            <span className="lu-info-hint">
              {showDefinitions
                ? 'Point at a term or focus it to see what it means. Pick four that belong together.'
                : 'The definitions are blurred. Pick four terms that belong together, or show them with the eye.'}
            </span>
          ) : (
            <>
              <strong>{infoTile.name}</strong>{' '}
              <span
                className="lu-definition"
                data-blurred={!showDefinitions || undefined}
                aria-hidden={!showDefinitions || undefined}
              >
                {infoTile.definition}
              </span>
            </>
          )}
        </p>
        <button
          type="button"
          className="lu-eye"
          aria-pressed={showDefinitions}
          aria-label="Show definitions"
          title={showDefinitions ? 'Blur the definitions (harder)' : 'Show the definitions'}
          onClick={() => {
            setShowDefinitions((current) => !current);
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            {showDefinitions ? (
              <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              >
                <path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0" />
                <circle cx="12" cy="12" r="3" />
              </g>
            ) : (
              <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              >
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242" />
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20" />
              </g>
            )}
          </svg>
        </button>
      </div>

      {/* The space of the result is always there, so nothing on the page moves when it appears */}
      <div className="lu-end">
        {over && (
          <div className="lu-result" ref={resultRef} tabIndex={-1} data-status={game.status}>
            <h2>{won ? 'Solved!' : 'Out of tries'}</h2>
            <p>
              {won
                ? game.mistakes === 0
                  ? 'All four groups, without a single mistake.'
                  : `All four groups, with ${String(game.mistakes)} ${game.mistakes === 1 ? 'mistake' : 'mistakes'}.`
                : 'These were the groups you did not find.'}
            </p>
          </div>
        )}
      </div>
      <div className="lu-footer">
        <button
          type="button"
          data-primary={over || undefined}
          onClick={restart}
          disabled={reaction !== null || starting}
        >
          New puzzle
        </button>
        <button type="button" onClick={copyLink}>
          Copy link to this puzzle
        </button>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/**
 * Link Up: sort sixteen terms into four hidden groups. The words and definitions (a few hundred
 * kilobytes) are not part of the first script: the files that hold the four categories of a puzzle
 * are fetched when the page opens.
 */
export default function LinkUp() {
  const [start, setStart] = useState<{ seed: number; game: Game } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    firstGame().then(
      (first) => {
        if (current) {
          setStart(first);
        }
      },
      () => {
        if (current) {
          setFailed(true);
        }
      },
    );
    return () => {
      current = false;
    };
  }, []);

  if (start === null) {
    return (
      <LinkUpSkeleton
        message={
          failed
            ? 'The puzzle could not be loaded. Please reload the page.'
            : 'Loading the puzzle...'
        }
      />
    );
  }
  return <LinkUpBoard initialSeed={start.seed} initialGame={start.game} />;
}
