import { type CSSProperties, type SubmitEvent, useEffect, useMemo, useRef, useState } from 'react';

import { freshSeed } from '../../shared/random';
import { loadWordData } from '../data/load';
import { type WordData } from '../logic/data';
import { type Language, locales, parseLanguage } from '../logic/language';
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
import { type Texts, texts } from '../logic/texts';
import MapView from './MapView';
import RadarView from './RadarView';
import SwapLabel from './SwapLabel';
import WordRadarSkeleton from './WordRadarSkeleton';

const NEAREST_COUNT = 40;

interface Note {
  text: string;
  tone: 'neutral' | 'good' | 'warn';
}

/** One word with its rank, a bar for how close it is, and a label that says it in words. */
function Row({
  guess,
  size,
  t,
  locale,
  mark,
}: {
  guess: Guess;
  size: number;
  t: Texts;
  locale: string;
  mark?: string | undefined;
}) {
  const bucket = bucketOf(guess.rank);
  return (
    <>
      <span className="wr-word">
        {guess.word}
        {guess.hint && <span className="wr-tag">{t.tagHint}</span>}
        {guess.synonym && <span className="wr-tag">{t.tagSynonym}</span>}
        {mark !== undefined && <span className="wr-tag">{mark}</span>}
      </span>
      <span className="wr-rank">{guess.rank.toLocaleString(locale)}</span>
      <span className="wr-bucket">{t.bucket[bucket.id]}</span>
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
  const language = data.language;
  const t = texts[language];
  const locale = locales[language];
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

  const describe = (guess: Guess, prefix = ''): string =>
    `${prefix}${t.described(guess.word, guess.rank.toLocaleString(locale), t.bucket[bucketOf(guess.rank).id].toLowerCase())}`;

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
        {
          // Hunde counts as Hund, and Hirn means the same as Gehirn
          const guesses = result.round.guesses.length;
          let message: string;
          if (result.round.status === 'won') {
            message = result.guess.synonym
              ? t.foundSynonym(text.trim(), secretWord, guesses)
              : result.form === undefined
                ? t.found(result.guess.word, guesses)
                : t.foundByForm(result.form, result.guess.word, guesses);
          } else {
            message =
              (result.form === undefined ? '' : t.viaForm(result.form)) + describe(result.guess);
          }
          setNote({ text: message, tone: result.round.status === 'won' ? 'good' : 'neutral' });
        }
        break;
      case 'duplicate':
        setNote({
          text: t.duplicate(result.guess.word, result.guess.rank.toLocaleString(locale)),
          tone: 'warn',
        });
        break;
      case 'unknown':
        setNote({ text: t.unknown(result.word), tone: 'warn' });
        break;
      case 'invalid':
        setNote({ text: t.invalid, tone: 'warn' });
        break;
      case 'over':
        break;
    }
  };

  const hint = (): void => {
    const result = takeHint(round, data);
    if (result === null) {
      setNote({ text: t.noHint, tone: 'warn' });
      return;
    }
    setRound(result.round);
    setLatest(result.guess);
    setNote({ text: describe(result.guess, t.hintPrefix), tone: 'neutral' });
    inputRef.current?.focus({ preventScroll: true });
  };

  const surrender = (): void => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setRound(giveUp(round));
    setNote({ text: t.wordWas(secretWord), tone: 'neutral' });
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
    const url = buildRoundUrl(
      `${window.location.origin}${window.location.pathname}`,
      seed,
      language,
    );
    navigator.clipboard.writeText(url).then(
      () => {
        setNote({ text: t.linkCopied, tone: 'neutral' });
      },
      () => {
        setNote({ text: t.copyFailed, tone: 'warn' });
      },
    );
  };

  return (
    <div className="wr" data-over={over || undefined} lang={language}>
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
          placeholder={over ? t.placeholderOver : t.placeholder}
          aria-label={t.guessLabel}
          disabled={over}
          maxLength={30}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <button type="submit" disabled={over || text.trim() === ''} data-primary>
          {t.guessButton}
        </button>
      </form>

      <p className="wr-message" role="status" data-tone={note?.tone}>
        {note?.text ?? (round.guesses.length === 0 ? t.intro : '')}
      </p>

      <div className="wr-main">
        <section className="wr-panel wr-radar-panel" aria-label={t.radarSection}>
          <div className="wr-switch" role="group" aria-label={t.pictureGroup}>
            <button
              type="button"
              aria-pressed={view === 'radar'}
              onClick={() => {
                setChosenView('radar');
              }}
            >
              {t.radar}
            </button>
            <button
              type="button"
              aria-pressed={view === 'map'}
              disabled={!over}
              title={over ? undefined : t.mapLocked}
              onClick={() => {
                setChosenView('map');
              }}
            >
              {t.map}
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

        <section className="wr-panel wr-list-panel" aria-label={t.guessesSection}>
          <div className="wr-switch" role="group" aria-label={t.listGroup}>
            <button
              type="button"
              aria-pressed={list === 'guesses'}
              onClick={() => {
                setChosenList('guesses');
              }}
            >
              {t.yourGuesses(round.guesses.length)}
            </button>
            <button
              type="button"
              aria-pressed={list === 'nearest'}
              disabled={!over}
              title={over ? undefined : t.nearestLocked}
              onClick={() => {
                setChosenList('nearest');
              }}
            >
              {t.nearestWords}
            </button>
          </div>
          <div className="wr-latest" aria-hidden={latest === null || undefined}>
            {list === 'guesses' && latest !== null && (
              <div className="wr-row" data-bucket={bucketOf(latest.rank).id} data-latest>
                <Row guess={latest} size={size} t={t} locale={locale} mark={t.tagLatest} />
              </div>
            )}
          </div>
          {/* A box that scrolls must be reachable with the keyboard (axe: scrollable-region-focusable) */}
          {/* eslint-disable jsx-a11y/no-noninteractive-tabindex */}
          <ol
            className="wr-list"
            data-layout-fluid
            tabIndex={0}
            aria-label={list === 'guesses' ? t.guessesList : t.nearestList}
          >
            {list === 'guesses'
              ? sorted.map((guess) => (
                  <li
                    key={guess.index}
                    className="wr-row"
                    data-bucket={bucketOf(guess.rank).id}
                    data-latest={latest?.index === guess.index || undefined}
                  >
                    <Row guess={guess} size={size} t={t} locale={locale} />
                  </li>
                ))
              : nearest.map((guess) => (
                  <li key={guess.index} className="wr-row" data-bucket={bucketOf(guess.rank).id}>
                    <Row
                      guess={guess}
                      size={size}
                      t={t}
                      locale={locale}
                      mark={
                        round.guesses.some((entry) => entry.index === guess.index)
                          ? t.tagYou
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
          {t.hint(hints)}
        </button>
        <button
          type="button"
          onClick={surrender}
          disabled={over}
          data-confirming={confirming || undefined}
        >
          <SwapLabel
            shown={confirming ? t.reallyGiveUp : t.giveUp}
            other={confirming ? t.giveUp : t.reallyGiveUp}
          />
        </button>
        <button type="button" onClick={restart} data-primary={over || undefined}>
          {t.newRound}
        </button>
        <button type="button" onClick={copyLink}>
          {t.copyLink}
        </button>
      </div>

      {/* The space of the result is always there, so nothing on the page moves when it appears */}
      <div className="wr-end">
        {over && (
          <div className="wr-result" ref={resultRef} tabIndex={-1} data-status={round.status}>
            <h2>
              {round.status === 'won' ? t.foundTitle : t.wasTitle} <strong>{secretWord}</strong>
            </h2>
            <p>
              {round.status === 'won' ? t.summary(round.guesses.length, hints) : t.gaveUpSummary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Word Radar: find a hidden word by how close your guesses are in meaning. The words and their
 * numbers (about 2 MB) are fetched when the page opens, in the language of the address.
 */
export default function WordRadar() {
  const [data, setData] = useState<WordData | null>(null);
  const [failed, setFailed] = useState(false);
  const [language] = useState<Language>(() => parseLanguage(window.location.search));
  const [seed] = useState(() => parseSeed(window.location.search, freshSeed));
  useEffect(() => {
    let current = true;
    loadWordData(language).then(
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
  }, [language]);

  if (data === null) {
    return (
      <WordRadarSkeleton
        language={language}
        message={failed ? texts[language].loadFailed : undefined}
      />
    );
  }
  return <Board data={data} initialSeed={seed} />;
}
