import { type CSSProperties, useState } from 'react';

import { type WordData } from '../logic/data';
import { angleOf, bucketOf, radiusOf } from '../logic/radar';
import { type Guess } from '../logic/round';

/** Half the width of the picture: the middle is at 0, the edge at 100. */
const REACH = 90;
/** The ranks that are drawn as rings, and what is written on them */
const RINGS = [
  { rank: 10, label: '10' },
  { rank: 100, label: '100' },
  { rank: 1000, label: '1k' },
  { rank: 10_000, label: '10k' },
];
/** One turn of the sweep, in seconds (the same number is in the style sheet) */
const PERIOD = 5;

interface Props {
  data: WordData;
  /** The plane that decides the direction of a word (see `radarPlane`) */
  plane: readonly [Float64Array, Float64Array];
  secret: number;
  guesses: readonly Guess[];
  /** The newest guess, which pops up and sends out a ring */
  latest: Guess | null;
  /** The word is shown in the middle when the round is over */
  revealed: boolean;
}

interface DotProps {
  guess: Guess;
  data: WordData;
  plane: readonly [Float64Array, Float64Array];
  secret: number;
  size: number;
  startedAt: number;
  isLatest: boolean;
  labelled: boolean;
}

/**
 * One guess on the radar. It flashes at the moment the beam passes it: the beam points to the
 * north and turns clockwise, the angle of a word is counted from the east, and the delay of the
 * flash is worked out once, when the dot appears, from how long the beam has been turning.
 */
function Dot({ guess, data, plane, secret, size, startedAt, isLatest, labelled }: DotProps) {
  const radius = radiusOf(guess.rank, size) * REACH;
  const angle = angleOf(data, secret, guess.index, plane);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const [delay] = useState(() => {
    const turn = ((((angle + Math.PI / 2) / (2 * Math.PI)) % 1) + 1) % 1;
    const elapsed = (performance.now() - startedAt) / 1000;
    return (((turn * PERIOD - elapsed) % PERIOD) + PERIOD) % PERIOD;
  });
  const bucket = bucketOf(guess.rank);
  return (
    <g
      className="wr-dot"
      data-bucket={bucket.id}
      data-latest={isLatest || undefined}
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
      style={{ '--wr-delay': `${delay.toFixed(2)}s` } as CSSProperties}
    >
      <circle className="wr-blip" r="3" />
      {isLatest && <circle className="wr-ripple" r="4" />}
      <circle className="wr-dot-body" r={isLatest ? 3.6 : 2.8} />
      {labelled && (
        <text
          className="wr-dot-label"
          y={y > 0 ? -5 : 8}
          textAnchor={x > 55 ? 'end' : x < -55 ? 'start' : 'middle'}
        >
          {guess.word}
        </text>
      )}
    </g>
  );
}

/**
 * The radar: the hidden word is in the middle, and every guess is a dot. The closer the word is in
 * meaning (the better its rank), the closer the dot is to the middle, on a logarithmic scale; the
 * direction around the middle comes from how the word differs from the hidden word. A beam sweeps
 * round the picture, and every dot flashes when the beam passes it. The picture is decorative: the
 * list next to it carries the same information for assistive technology.
 */
export default function RadarView({ data, plane, secret, guesses, latest, revealed }: Props) {
  const size = data.words.length;
  // The beam started when the radar appeared
  const [startedAt] = useState(() => performance.now());
  // The words that are written next to their dot: the closest ones and the newest one
  const labelled = new Set(
    [...guesses]
      .sort((x, y) => x.rank - y.rank)
      .slice(0, 6)
      .map((guess) => guess.index),
  );
  if (latest !== null) {
    labelled.add(latest.index);
  }

  return (
    <div className="wr-radar-wrap">
      <svg className="wr-radar" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
        <circle className="wr-disc" r="96" />
        {RINGS.map((ring) => (
          <g key={ring.rank}>
            <circle className="wr-ring" r={radiusOf(ring.rank, size) * REACH} />
            <text
              className="wr-ring-label"
              x="0"
              y={-radiusOf(ring.rank, size) * REACH - 1.5}
              textAnchor="middle"
            >
              {ring.label}
            </text>
          </g>
        ))}
        <line className="wr-axis" x1="-96" y1="0" x2="96" y2="0" />
        <line className="wr-axis" x1="0" y1="-96" x2="0" y2="96" />

        {/* The hidden word */}
        <g className="wr-target" data-revealed={revealed || undefined}>
          {revealed && <circle className="wr-burst" r="4" />}
          <circle r="4" className="wr-target-dot" />
          <text className="wr-target-label" y="-7" textAnchor="middle">
            {revealed ? (data.words[secret] ?? '') : '?'}
          </text>
        </g>

        {guesses.map((guess) => (
          <Dot
            key={guess.index}
            guess={guess}
            data={data}
            plane={plane}
            secret={secret}
            size={size}
            startedAt={startedAt}
            isLatest={latest?.index === guess.index}
            labelled={labelled.has(guess.index)}
          />
        ))}
      </svg>
      <div className="wr-sweep" aria-hidden="true" />
    </div>
  );
}
