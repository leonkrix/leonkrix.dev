import './tech-words.css';

import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { createRandom, freshSeed } from '../../shared/random';
import { techCategories, techCategoryLabels, type TechTerm } from '../../shared/tech-term';
import { loadTerms } from '../data';
import { evaluateGuess } from '../logic/evaluate';
import { keyStates } from '../logic/keyboard';
import { buildPuzzleUrl, parsePuzzleParams, type PuzzleSetup } from '../logic/link';
import {
  deleteLetter,
  MAX_TRIES,
  type Round,
  startRound,
  submitGuess,
  typeLetter,
} from '../logic/round';
import { categoryCounts, LENGTHS, MIN_TERMS_PER_CATEGORY, selectTerm } from '../logic/select';
import { shareText } from '../logic/share';
import { Board } from './Board';
import { Keyboard } from './Keyboard';
import { ResultCard } from './ResultCard';

/** The round in play together with the list it came from. */
interface Game {
  terms: readonly TechTerm[];
  known: ReadonlySet<string>;
  round: Round;
}

const TOAST_MILLISECONDS = 1800;

/**
 * The address can prepare a round: ?length=4, ?category=security and ?seed=anything (the same seed
 * always gives the same term). The link in a copied result contains all three.
 */
function readInitialSetup(): PuzzleSetup {
  return parsePuzzleParams(window.location.search, freshSeed);
}

/** The sentence a screen reader hears after a guess was handed in. */
function describeGuess(round: Round): string {
  const guess = round.guesses.at(-1) ?? '';
  const letters = evaluateGuess(guess, round.answer.term).map(
    (state, index) => `${guess.charAt(index)} ${state === 'present' ? 'elsewhere' : state}`,
  );
  const base = `Guess ${String(round.guesses.length)} of ${String(MAX_TRIES)}: ${letters.join(', ')}.`;
  const { term, definition } = round.answer;
  if (round.status === 'won') {
    return `${base} You found it: ${term}. ${definition}`;
  }
  return round.status === 'lost'
    ? `${base} Out of tries. The term was ${term}. ${definition}`
    : base;
}

/** Tech Words: guess the hidden tech term in six tries. */
export default function TechWords() {
  const [setup, setSetup] = useState<PuzzleSetup>(readInitialSetup);
  const [game, setGame] = useState<Game | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [shake, setShake] = useState<'a' | 'b' | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const toastCountRef = useRef(0);

  // Load the list for the chosen length and start a round whenever the setup changes
  useEffect(() => {
    let cancelled = false;
    void loadTerms(setup.length).then((terms) => {
      if (cancelled) {
        return;
      }
      const answer = selectTerm(terms, setup.category, createRandom(setup.seed));
      setGame({ terms, known: new Set(terms.map(({ term }) => term)), round: startRound(answer) });
      setShake(null);
      setToast(null);
      setAnnouncement(
        `New round: a tech term with ${String(answer.term.length)} letters. Six tries.`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [setup]);

  // The message above the board disappears by itself
  useEffect(() => {
    if (toast === null) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, TOAST_MILLISECONDS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const status = game?.round.status;
  // When the round is over, move the focus to the result so screen readers land on it
  useEffect(() => {
    if (status === 'won' || status === 'lost') {
      resultRef.current?.focus({ preventScroll: true });
    }
  }, [status]);

  const flash = (text: string): void => {
    toastCountRef.current += 1;
    setToast({ text, id: toastCountRef.current });
    setAnnouncement(text);
  };

  const press = (letter: string): void => {
    if (game !== null) {
      setGame({ ...game, round: typeLetter(game.round, letter) });
    }
  };

  const erase = (): void => {
    if (game !== null) {
      setGame({ ...game, round: deleteLetter(game.round) });
    }
  };

  const submit = (): void => {
    if (game === null) {
      return;
    }
    const { round, outcome } = submitGuess(game.round, (word) => game.known.has(word));
    if (outcome === 'too-short' || outcome === 'not-in-list') {
      flash(outcome === 'too-short' ? 'Not enough letters' : 'Not in the word list');
      setShake((current) => (current === 'a' ? 'b' : 'a'));
    } else if (outcome === 'accepted') {
      setGame({ ...game, round });
      setShake(null);
      setAnnouncement(describeGuess(round));
    }
  };

  const newRound = (): void => {
    setSetup((current) => ({ ...current, seed: freshSeed() }));
    // Never leave the focus on a button: the next Enter key must hand in a guess, not press it
    boardRef.current?.focus({ preventScroll: true });
  };

  const copyResult = async (): Promise<void> => {
    if (game === null) {
      return;
    }
    try {
      // The link opens the very same puzzle, so whoever gets the result can play it right away
      const url = buildPuzzleUrl(`${window.location.origin}${window.location.pathname}`, setup);
      await navigator.clipboard.writeText(shareText(game.round, url));
      flash('Result copied');
    } catch {
      flash('Copying is not possible here');
    }
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    // Typing into a menu or a text field is not meant for the game
    if (target?.closest('select, textarea, input:not([type="radio"]), [contenteditable]')) {
      return;
    }
    if (event.key === 'Enter') {
      // A focused button handles Enter itself
      if (target?.closest('button, a, summary')) {
        return;
      }
      event.preventDefault();
      if (game?.round.status === 'playing') {
        submit();
      } else if (game !== null) {
        newRound();
      }
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      erase();
    } else if (/^[a-z]$/i.test(event.key)) {
      press(event.key);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent): void => {
      onKeyDown(event);
    };
    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);

  const counts = game === null ? new Map<string, number>() : categoryCounts(game.terms);
  const categoryAvailable =
    setup.category === 'all' || (counts.get(setup.category) ?? 0) >= MIN_TERMS_PER_CATEGORY;
  const finished = game !== null && game.round.status !== 'playing';

  return (
    <div className="tw space-y-3 sm:space-y-5">
      <div className="tw-setup">
        <fieldset className="tw-lengths">
          <legend className="sr-only">Word length</legend>
          {LENGTHS.map((length) => (
            <label key={length}>
              <input
                type="radio"
                name="length"
                value={length}
                checked={setup.length === length}
                onChange={() => {
                  setSetup((current) => ({ ...current, length, seed: freshSeed() }));
                }}
              />
              <span>{length} letters</span>
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm text-muted">
          Category
          <select
            className="tw-select"
            value={categoryAvailable ? setup.category : 'all'}
            onChange={(event) => {
              const chosen = techCategories.find((category) => category === event.target.value);
              setSetup((current) => ({
                ...current,
                category: chosen ?? 'all',
                seed: freshSeed(),
              }));
            }}
          >
            <option value="all">All categories</option>
            {techCategories.map((category) => {
              const count = counts.get(category) ?? 0;
              return (
                <option
                  key={category}
                  value={category}
                  disabled={game !== null && count < MIN_TERMS_PER_CATEGORY}
                >
                  {techCategoryLabels[category]}
                  {game === null ? '' : ` (${String(count)})`}
                </option>
              );
            })}
          </select>
        </label>
        <button
          type="button"
          onClick={newRound}
          className="btn-outline inline-flex items-center rounded-lg px-4 py-2 text-sm text-fg"
        >
          New round
        </button>
      </div>

      <div className="tw-toast" aria-hidden="true">
        {toast !== null && <span key={toast.id}>{toast.text}</span>}
      </div>

      {game === null ? (
        <p className="tw-board place-content-center text-center text-muted">Loading terms...</p>
      ) : (
        <Board round={game.round} shake={shake} boardRef={boardRef} />
      )}

      <div className="tw-lower">
        {finished ? (
          <ResultCard
            round={game.round}
            cardRef={resultRef}
            onNewRound={newRound}
            onCopy={() => {
              void copyResult();
            }}
          />
        ) : (
          <Keyboard
            states={
              game === null ? new Map() : keyStates(game.round.guesses, game.round.answer.term)
            }
            onLetter={press}
            onEnter={submit}
            onDelete={erase}
          />
        )}
      </div>

      <div role="status" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
