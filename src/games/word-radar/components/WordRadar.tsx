import { type CSSProperties, type SubmitEvent, useEffect, useMemo, useRef, useState } from 'react';

import { freshSeed } from '../../shared/random';
import { loadWordData } from '../data/load';
import { type WordData } from '../logic/data';
import { buildRoundUrl, parseSeed } from '../logic/link';
import { bucketOf, closenessOf, radarPlane } from '../logic/radar';
import {
  giveUp,
  type Guess,
  guessWord,
  nearestWords,
  pickSecret,
  type Round,
  startRound,
  takeHint,
} from '../logic/round';
import MapView from './MapView';
import RadarView from './RadarView';
import WordRadarSkeleton from './WordRadarSkeleton';

const NEAREST_COUNT = 40;

interface Note {
  text: string;
  tone: 'neutral' | 'good' | 'warn';
}

const describe = (guess: Guess, prefix = ''): string =>
  `${prefix}${guess.word}: rank ${guess.rank.toLocaleString('en-US')}, ${bucketOf(guess.rank).label.toLowerCase()}`;

/** One word with its rank, a bar for how close it is, and a label that says it in words. */
function Row({ guess, size, mark }: { guess: Guess; size: number; mark?: string | undefined }) {
  const bucket = bucketOf(guess.rank);
  return (
    <>
      <span className="wr-word">
        {guess.word}
        {guess.hint && <span className="wr-tag">hint</span>}
        {mark !== undefined && <span className="wr-tag">{mark}</span>}
      </span>
      <span className="wr-rank">{guess.rank.toLocaleString('en-US')}</span>
      <span className="wr-bucket">{bucket.label}</span>
      <span
        className="wr-bar"
        style={{ '--fill': closenessOf(guess.rank, size).toFixed(3) } as CSSProperties}
        aria-hidden="true"
      />
    </>
  );
}

/** The game itself, once the words are loaded. */
function Board({ data, initialSeed }: { data: WordData; initialSeed: number }) {
  const [seed, setSeed] = useState(initialSeed);
  const [round, setRound] = useState<Round>(() => startRound(data, pickSecret(data, initialSeed)));
  const [text, setText] = useState('');
  const [note, setNote] = useState<Note | null>(null);
  const [latest, setLatest] = useState<Guess | null>(null);
  // What the player chose to look at (null: the standard, which changes when the round is over)
  const [chosenView, setChosenView] = useState<'radar' | 'map' | null>(null);
  const [chosenList, setChosenList] = useState<'guesses' | 'nearest' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const over = round.status !== 'playing';
  const view = chosenView ?? (over ? 'map' : 'radar');
  const list = chosenList ?? (over ? 'nearest' : 'guesses');
  const size = data.words.length;
  const secretWord = data.words[round.secret] ?? '';
  const hints = round.guesses.filter((guess) => guess.hint).length;
  const sorted = useMemo(() => [...round.guesses].sort((a, b) => a.rank - b.rank), [round.guesses]);
  // Where the directions of the radar point: found once for every round
  const plane = useMemo(() => radarPlane(data, round.ranking.order), [data, round.ranking]);
  const nearest = useMemo(
    () => (over ? nearestWords(round, data, NEAREST_COUNT) : []),
    [over, round, data],
  );

  // Put the cursor in the field, unless the device has a touch screen (it would open the keyboard)
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  // When the round ends, the result gets the focus
  useEffect(() => {
    if (over) {
      resultRef.current?.focus({ preventScroll: true });
    }
  }, [over]);

  // "Give up" asks twice: the question goes away by itself
  useEffect(() => {
    if (!confirming) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setConfirming(false);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [confirming]);

  const submit = (event: SubmitEvent): void => {
    event.preventDefault();
    const result = guessWord(round, data, text);
    switch (result.kind) {
      case 'ok':
        setRound(result.round);
        setLatest(result.guess);
        setText('');
        setNote(
          result.round.status === 'won'
            ? {
                text: `Found it! The word is ${result.guess.word}, after ${String(result.round.guesses.length)} ${result.round.guesses.length === 1 ? 'guess' : 'guesses'}.`,
                tone: 'good',
              }
            : { text: describe(result.guess), tone: 'neutral' },
        );
        break;
      case 'duplicate':
        setNote({
          text: `You tried ${result.guess.word} already: rank ${result.guess.rank.toLocaleString('en-US')}.`,
          tone: 'warn',
        });
        break;
      case 'unknown':
        setNote({
          text: `${result.word} is not in the word list. Try another word, or a simpler form such as the singular.`,
          tone: 'warn',
        });
        break;
      case 'invalid':
        setNote({ text: 'Type one word, with letters only.', tone: 'warn' });
        break;
      case 'over':
        break;
    }
  };

  const hint = (): void => {
    const result = takeHint(round, data);
    if (result === null) {
      setNote({ text: 'There is no closer hint left. Keep guessing!', tone: 'warn' });
      return;
    }
    setRound(result.round);
    setLatest(result.guess);
    setNote({ text: describe(result.guess, 'Hint: '), tone: 'neutral' });
    inputRef.current?.focus({ preventScroll: true });
  };

  const surrender = (): void => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setRound(giveUp(round));
    setNote({ text: `The word was ${secretWord}.`, tone: 'neutral' });
  };

  const restart = (): void => {
    const next = freshSeed();
    setSeed(next);
    setRound(startRound(data, pickSecret(data, next)));
    setText('');
    setNote(null);
    setLatest(null);
    setChosenView(null);
    setChosenList(null);
    setConfirming(false);
    window.requestAnimationFrame(() => {
      if (!window.matchMedia('(pointer: coarse)').matches) {
        inputRef.current?.focus({ preventScroll: true });
      }
    });
  };

  const copyLink = (): void => {
    const url = buildRoundUrl(`${window.location.origin}${window.location.pathname}`, seed);
    navigator.clipboard.writeText(url).then(
      () => {
        setNote({ text: 'Link to this round copied.', tone: 'neutral' });
      },
      () => {
        setNote({ text: 'Copying was not possible.', tone: 'warn' });
      },
    );
  };

  return (
    <div className="wr" data-over={over || undefined}>
      <form className="wr-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="wr-input"
          type="text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setText('');
            }
          }}
          placeholder={over ? 'The round is over' : 'Type a word and press Enter'}
          aria-label="Your guess"
          disabled={over}
          maxLength={20}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <button type="submit" disabled={over || text.trim() === ''} data-primary>
          Guess
        </button>
      </form>

      <p className="wr-message" role="status" data-tone={note?.tone}>
        {note?.text ??
          (round.guesses.length === 0
            ? 'Find the hidden word. The closer a guess is in meaning, the lower its rank: rank 1 is the word itself.'
            : '')}
      </p>

      <div className="wr-main">
        <section className="wr-panel wr-radar-panel" aria-label="Radar">
          <div className="wr-switch" role="group" aria-label="Picture">
            <button
              type="button"
              aria-pressed={view === 'radar'}
              onClick={() => {
                setChosenView('radar');
              }}
            >
              Radar
            </button>
            <button
              type="button"
              aria-pressed={view === 'map'}
              disabled={!over}
              title={over ? undefined : 'The map is shown when the round is over'}
              onClick={() => {
                setChosenView('map');
              }}
            >
              Map
            </button>
          </div>
          {view === 'radar' ? (
            <RadarView
              data={data}
              plane={plane}
              secret={round.secret}
              guesses={round.guesses}
              latest={latest}
              revealed={over}
            />
          ) : (
            <MapView data={data} secret={round.secret} guesses={round.guesses} nearest={nearest} />
          )}
        </section>

        <section className="wr-panel wr-list-panel" aria-label="Guesses">
          <div className="wr-switch" role="group" aria-label="List">
            <button
              type="button"
              aria-pressed={list === 'guesses'}
              onClick={() => {
                setChosenList('guesses');
              }}
            >
              Your guesses ({round.guesses.length})
            </button>
            <button
              type="button"
              aria-pressed={list === 'nearest'}
              disabled={!over}
              title={over ? undefined : 'The nearest words are shown when the round is over'}
              onClick={() => {
                setChosenList('nearest');
              }}
            >
              Nearest words
            </button>
          </div>
          <div className="wr-latest" aria-hidden={latest === null || undefined}>
            {list === 'guesses' && latest !== null && (
              <div className="wr-row" data-bucket={bucketOf(latest.rank).id} data-latest>
                <Row guess={latest} size={size} mark="latest" />
              </div>
            )}
          </div>
          {/* A box that scrolls must be reachable with the keyboard (axe: scrollable-region-focusable) */}
          {/* eslint-disable jsx-a11y/no-noninteractive-tabindex */}
          <ol
            className="wr-list"
            data-layout-fluid
            tabIndex={0}
            aria-label={
              list === 'guesses'
                ? 'Guesses made so far, closest first'
                : 'The words nearest to the hidden word'
            }
          >
            {list === 'guesses'
              ? sorted.map((guess) => (
                  <li
                    key={guess.index}
                    className="wr-row"
                    data-bucket={bucketOf(guess.rank).id}
                    data-latest={latest?.index === guess.index || undefined}
                  >
                    <Row guess={guess} size={size} />
                  </li>
                ))
              : nearest.map((guess) => (
                  <li key={guess.index} className="wr-row" data-bucket={bucketOf(guess.rank).id}>
                    <Row
                      guess={guess}
                      size={size}
                      mark={
                        round.guesses.some((entry) => entry.index === guess.index)
                          ? 'you'
                          : undefined
                      }
                    />
                  </li>
                ))}
          </ol>
          {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
        </section>
      </div>

      <div className="wr-tools">
        <button type="button" onClick={hint} disabled={over}>
          Hint{hints > 0 ? ` (${String(hints)})` : ''}
        </button>
        <button
          type="button"
          onClick={surrender}
          disabled={over}
          data-confirming={confirming || undefined}
        >
          {confirming ? 'Really give up?' : 'Give up'}
        </button>
        <button type="button" onClick={restart} data-primary={over || undefined}>
          New round
        </button>
        <button type="button" onClick={copyLink}>
          Copy link to this round
        </button>
      </div>

      {/* The space of the result is always there, so nothing on the page moves when it appears */}
      <div className="wr-end">
        {over && (
          <div className="wr-result" ref={resultRef} tabIndex={-1} data-status={round.status}>
            <h2>
              {round.status === 'won' ? 'Found it!' : 'The word was'} <strong>{secretWord}</strong>
            </h2>
            <p>
              {round.status === 'won'
                ? `${String(round.guesses.length)} ${round.guesses.length === 1 ? 'guess' : 'guesses'}${hints > 0 ? `, ${String(hints)} ${hints === 1 ? 'hint' : 'hints'}` : ''}.`
                : 'The map shows your guesses, the list the nearest words.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Word Radar: find a hidden word by how close your guesses are in meaning. The words and their
 * numbers (about 2 MB) are fetched when the page opens.
 */
export default function WordRadar() {
  const [data, setData] = useState<WordData | null>(null);
  const [failed, setFailed] = useState(false);
  const [seed] = useState(() => parseSeed(window.location.search, freshSeed));
  useEffect(() => {
    let current = true;
    loadWordData().then(
      (loaded) => {
        if (current) {
          setData(loaded);
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

  if (data === null) {
    return (
      <WordRadarSkeleton
        message={
          failed
            ? 'The words could not be loaded. Please reload the page.'
            : 'Loading the words (about 2 MB)...'
        }
      />
    );
  }
  return <Board data={data} initialSeed={seed} />;
}
