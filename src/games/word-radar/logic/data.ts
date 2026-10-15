import { type Language } from './language';

/** The numbers that describe a word: 64 whole numbers (see ../README.md, "Data"). */
export const DIMENSIONS = 64;

/** Everything the game knows about its words. */
export interface WordData {
  language: Language;
  /** The words as they are written (German nouns with a capital), commonest first. The rank of a guess is counted among these words. */
  words: readonly string[];
  /** The position of a word by its lower case form: what a player types is looked up in lower case */
  indexOf: ReadonlyMap<string, number>;
  /** `DIMENSIONS` numbers per word, row by row, every row of length 1 (so a dot product is the cosine) */
  vectors: Float32Array;
  /** The words that can be hidden, as positions in `words` */
  secrets: readonly number[];
  /** Inflected forms (hunde) and the position of their word (hund): typing a form counts as typing the word */
  forms: ReadonlyMap<string, number>;
  /** For a hidden word the words that mean the same (hirn for gehirn): guessing one of them finds it */
  aliases: ReadonlyMap<number, ReadonlySet<number>>;
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

/**
 * Puts the files together and checks that they belong together. A line of the hidden words can
 * have words that mean the same after a tab, separated by commas ("Gehirn", tab, "Hirn,Denkorgan");
 * a line of the forms is the form, a tab and the position of its word.
 */
export function makeWordData(
  vocabulary: string,
  bytes: Int8Array,
  secrets: string,
  language: Language = 'en',
  forms = '',
): WordData {
  const words = parseWordList(vocabulary);
  const indexOf = new Map<string, number>();
  for (const [index, word] of words.entries()) {
    // If two words only differ in their capitals, the commoner one (the first) counts
    const key = word.toLowerCase();
    if (!indexOf.has(key)) {
      indexOf.set(key, index);
    }
  }
  const position = (word: string, what: string): number => {
    const index = indexOf.get(word.toLowerCase());
    if (index === undefined) {
      throw new Error(`The ${what} "${word}" is not in the word list`);
    }
    return index;
  };
  const secretIndexes: number[] = [];
  const aliases = new Map<number, Set<number>>();
  for (const line of parseWordList(secrets)) {
    const [word = '', same = ''] = line.split('\t');
    const index = position(word, 'hidden word');
    secretIndexes.push(index);
    const others = same
      .split(',')
      .filter((other) => other !== '')
      .map((other) => position(other, 'synonym'));
    if (others.length > 0) {
      aliases.set(index, new Set(others));
    }
  }
  const formIndexes = new Map<string, number>();
  for (const line of parseWordList(forms)) {
    const [form = '', at = ''] = line.split('\t');
    const index = Number(at);
    if (!Number.isInteger(index) || index < 0 || index >= words.length) {
      throw new Error(`The form "${form}" points to no word`);
    }
    if (!indexOf.has(form.toLowerCase()) && !formIndexes.has(form.toLowerCase())) {
      formIndexes.set(form.toLowerCase(), index);
    }
  }
  return {
    language,
    words,
    indexOf,
    vectors: decodeVectors(bytes, words.length),
    secrets: secretIndexes,
    forms: formIndexes,
    aliases,
  };
}

/** The numbers of one word. */
export function vectorOf(data: WordData, index: number): Float32Array {
  return data.vectors.subarray(index * DIMENSIONS, (index + 1) * DIMENSIONS);
}
