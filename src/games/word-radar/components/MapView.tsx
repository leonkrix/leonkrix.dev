import { useMemo } from 'react';

import { type WordData } from '../logic/data';
import { flatten } from '../logic/map';
import { bucketOf } from '../logic/radar';
import { type Guess } from '../logic/round';

const REACH = 86;
const NEAREST_LABELLED = 10;

interface Props {
  data: WordData;
  secret: number;
  guesses: readonly Guess[];
  /** The words that are closest to the hidden word, from the hidden word itself on */
  nearest: readonly Guess[];
}

/**
 * The map after a round: the hidden word, the words that were guessed (joined in the order they
 * were guessed) and the nearest words, flattened to a plane. The plane is found by a principal
 * component analysis, the two directions in which these words differ most, so words that mean
 * similar things lie close together.
 */
export default function MapView({ data, secret, guesses, nearest }: Props) {
  const points = useMemo(() => {
    const indexes = [secret];
    const seen = new Set(indexes);
    for (const guess of [...guesses, ...nearest]) {
      if (!seen.has(guess.index)) {
        seen.add(guess.index);
        indexes.push(guess.index);
      }
    }
    const flat = flatten(data, indexes);
    return new Map(indexes.map((index, position) => [index, flat[position] ?? [0, 0]]));
  }, [data, secret, guesses, nearest]);

  const place = (index: number): { x: number; y: number } => {
    const [x = 0, y = 0] = points.get(index) ?? [0, 0];
    return { x: x * REACH, y: y * REACH };
  };
  const guessed = new Set(guesses.map((guess) => guess.index));
  const path = guesses
    .map((guess) => {
      const { x, y } = place(guess.index);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const target = place(secret);

  return (
    <svg className="wr-map" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <rect className="wr-disc" x="-98" y="-98" width="196" height="196" rx="10" />
      {guesses.length > 1 && <polyline className="wr-path" points={path} />}
      {nearest.slice(1).map((guess, position) => {
        if (guessed.has(guess.index)) {
          return null;
        }
        const { x, y } = place(guess.index);
        return (
          <g key={guess.index} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            <circle className="wr-map-near" r="1.6" />
            {position < NEAREST_LABELLED && (
              <text className="wr-map-near-label" y="-3.2" textAnchor="middle">
                {guess.word}
              </text>
            )}
          </g>
        );
      })}
      {guesses.map((guess, position) => {
        const { x, y } = place(guess.index);
        return (
          <g
            key={guess.index}
            className="wr-dot"
            data-bucket={bucketOf(guess.rank).id}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
          >
            <circle className="wr-dot-body" r="2.8" />
            <text className="wr-dot-label" y="-5" textAnchor="middle">
              {`${String(position + 1)} ${guess.word}`}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${target.x.toFixed(1)} ${target.y.toFixed(1)})`}>
        <circle className="wr-target-dot" r="4" />
        <text className="wr-target-label" y="-7" textAnchor="middle">
          {data.words[secret] ?? ''}
        </text>
      </g>
    </svg>
  );
}
