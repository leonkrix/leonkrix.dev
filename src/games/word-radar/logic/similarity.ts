import { DIMENSIONS, vectorOf, type WordData } from './data';

/** How the words are ordered by closeness to the hidden word. */
export interface Ranking {
  /** The position of every word in the list of words: 1 is the hidden word itself */
  rankOf: Uint32Array;
  /** The words, closest first: `order[0]` is the hidden word */
  order: Uint32Array;
  /** The cosine similarity of every word to the hidden word */
  similarity: Float32Array;
}

/** The cosine similarity of every word to the word `target` (the vectors have length one). */
export function similarityTo(data: WordData, target: number): Float32Array {
  const count = data.words.length;
  const wanted = vectorOf(data, target);
  const result = new Float32Array(count);
  const { vectors } = data;
  for (let word = 0; word < count; word += 1) {
    const start = word * DIMENSIONS;
    let sum = 0;
    for (let index = 0; index < DIMENSIONS; index += 1) {
      sum += (vectors[start + index] ?? 0) * (wanted[index] ?? 0);
    }
    result[word] = sum;
  }
  return result;
}

/** Orders all the words by their closeness to `secret`. Takes a few milliseconds. */
export function rankWords(data: WordData, secret: number): Ranking {
  const similarity = similarityTo(data, secret);
  const order = Uint32Array.from({ length: data.words.length }, (_, index) => index);
  // The hidden word is first even if rounding makes another word look as close
  order.sort((a, b) =>
    a === secret ? -1 : b === secret ? 1 : (similarity[b] ?? 0) - (similarity[a] ?? 0) || a - b,
  );
  const rankOf = new Uint32Array(order.length);
  for (const [position, word] of order.entries()) {
    rankOf[word] = position + 1;
  }
  return { rankOf, order, similarity };
}
