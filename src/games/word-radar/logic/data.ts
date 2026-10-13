/** The numbers that describe a word: 64 whole numbers (see ../README.md, "Data"). */
export const DIMENSIONS = 64;

/** Everything the game knows about its words. */
export interface WordData {
  /** The words, commonest first. The rank of a guess is counted among these words. */
  words: readonly string[];
  indexOf: ReadonlyMap<string, number>;
  /** `DIMENSIONS` numbers per word, row by row, every row of length 1 (so a dot product is the cosine) */
  vectors: Float32Array;
  /** The words that can be hidden, as positions in `words` */
  secrets: readonly number[];
}

/** One word per line. */
export function parseWordList(text: string): string[] {
  return text.split('\n').filter((line) => line !== '');
}

/** Whole numbers from -127 to 127 back to numbers, with every row made exactly one unit long. */
export function decodeVectors(bytes: Int8Array, count: number): Float32Array {
  if (bytes.length !== count * DIMENSIONS) {
    throw new RangeError(
      `Expected ${String(count * DIMENSIONS)} numbers for ${String(count)} words, got ${String(bytes.length)}`,
    );
  }
  const vectors = new Float32Array(bytes.length);
  for (let word = 0; word < count; word += 1) {
    const start = word * DIMENSIONS;
    let sum = 0;
    for (let index = 0; index < DIMENSIONS; index += 1) {
      const value = bytes[start + index] ?? 0;
      vectors[start + index] = value;
      sum += value * value;
    }
    const length = Math.sqrt(sum) || 1;
    for (let index = 0; index < DIMENSIONS; index += 1) {
      vectors[start + index] = (vectors[start + index] ?? 0) / length;
    }
  }
  return vectors;
}

/** Puts the three files together and checks that they belong together. */
export function makeWordData(vocabulary: string, bytes: Int8Array, secrets: string): WordData {
  const words = parseWordList(vocabulary);
  const indexOf = new Map(words.map((word, index) => [word, index]));
  const secretIndexes = parseWordList(secrets).map((word) => {
    const index = indexOf.get(word);
    if (index === undefined) {
      throw new Error(`The hidden word "${word}" is not in the word list`);
    }
    return index;
  });
  return { words, indexOf, vectors: decodeVectors(bytes, words.length), secrets: secretIndexes };
}

/** The numbers of one word. */
export function vectorOf(data: WordData, index: number): Float32Array {
  return data.vectors.subarray(index * DIMENSIONS, (index + 1) * DIMENSIONS);
}
