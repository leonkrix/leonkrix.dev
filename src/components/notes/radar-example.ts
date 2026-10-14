/**
 * A real round of Word Radar, worked out when the site is built, for the figures of the note about
 * the game: the game's own data and the game's own functions, so nothing in the pictures is drawn
 * by hand. Server side only (it reads the data files).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeWordData, type WordData } from '@/games/word-radar/logic/data';
import { angleOf, bucketOf, radarPlane, radiusOf } from '@/games/word-radar/logic/radar';
import { startRound } from '@/games/word-radar/logic/round';

/** The half width of the radar in the picture (the game uses the same) */
export const REACH = 90;

/** The hidden word of the example */
export const SECRET = 'volcano';

/** The words that are guessed in the picture (spread over the ranks and the directions) */
const GUESSES = ['crater', 'mountain', 'smoke', 'weather', 'dinosaur', 'tourism', 'car'];

/** The ranks that are drawn as rings, like in the game */
export const RINGS = [
  { rank: 10, label: '10' },
  { rank: 100, label: '100' },
  { rank: 1000, label: '1k' },
  { rank: 10_000, label: '10k' },
];

export interface Dot {
  word: string;
  rank: number;
  similarity: number;
  x: number;
  y: number;
  bucket: string;
}

export interface Example {
  size: number;
  dots: Dot[];
  /** The nearest words, from the hidden word itself on */
  nearest: { rank: number; word: string; similarity: number }[];
  ringRadius: (rank: number) => number;
}

let cached: Example | undefined;

function load(): WordData {
  const folder = join(process.cwd(), 'src', 'games', 'word-radar', 'data');
  const read = (name: string): string => readFileSync(join(folder, name), 'utf8');
  return makeWordData(
    read('vocabulary.txt'),
    new Int8Array(readFileSync(join(folder, 'vectors.bin'))),
    read('secrets.txt'),
  );
}

export function radarExample(): Example {
  if (cached !== undefined) {
    return cached;
  }
  const data = load();
  const secret = data.indexOf.get(SECRET);
  if (secret === undefined) {
    throw new Error(`The example word "${SECRET}" is not in the word list`);
  }
  const round = startRound(data, secret);
  const plane = radarPlane(data, round.ranking.order);
  const size = data.words.length;

  const dots = GUESSES.map((word) => {
    const index = data.indexOf.get(word);
    if (index === undefined) {
      throw new Error(`The example guess "${word}" is not in the word list`);
    }
    const rank = round.ranking.rankOf[index] ?? size;
    const radius = radiusOf(rank, size) * REACH;
    const angle = angleOf(data, secret, index, plane);
    return {
      word,
      rank,
      similarity: round.ranking.similarity[index] ?? 0,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      bucket: bucketOf(rank).id,
    };
  });

  const nearest = Array.from(round.ranking.order.subarray(0, 12), (index, position) => ({
    rank: position + 1,
    word: data.words[index] ?? '',
    similarity: round.ranking.similarity[index] ?? 0,
  }));

  cached = {
    size,
    dots,
    nearest,
    ringRadius: (rank) => radiusOf(rank, size) * REACH,
  };
  return cached;
}
