/**
 * Reads word vectors in the binary word2vec format, as the NLPL repository distributes them (the
 * German model of Word Radar): a first line "<count> <dimensions>", then for every word its text,
 * a space, and the numbers as 32 bit floats (little endian). Some tools write a line break after
 * every vector and some do not, so a line break in front of a word is skipped. The words come
 * commonest first. The file is 2 GB, so it is read in pieces and can be stopped early. Used once,
 * by `build-data-de.ts`.
 */

export interface WordVector {
  word: string;
  vector: Float32Array;
}

export interface Word2VecHeader {
  count: number;
  dimensions: number;
}

const SPACE = 0x20;
const LINE_BREAK = 0x0a;

function concat(first: Uint8Array, second: Uint8Array): Uint8Array {
  if (first.length === 0) {
    return second;
  }
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first, 0);
  joined.set(second, first.length);
  return joined;
}

/**
 * The words of a word2vec file in order, at most `limit` of them. `chunks` is the file in any
 * pieces (for example a read stream), so that the file never has to fit in memory.
 */
export async function* readWord2Vec(
  chunks: AsyncIterable<Uint8Array>,
  limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<WordVector, Word2VecHeader> {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let pending: Uint8Array = new Uint8Array(0);
  let header: Word2VecHeader | undefined;
  let produced = 0;

  for await (const chunk of chunks) {
    pending = concat(pending, chunk);
    let position = 0;

    if (header === undefined) {
      const end = pending.indexOf(LINE_BREAK);
      if (end < 0) {
        continue;
      }
      const [count, dimensions] = decoder.decode(pending.subarray(0, end)).trim().split(/\s+/);
      header = { count: Number(count), dimensions: Number(dimensions) };
      if (!Number.isInteger(header.count) || !Number.isInteger(header.dimensions)) {
        throw new Error(
          'This is not a word2vec binary file (the first line is not "count dimensions").',
        );
      }
      position = end + 1;
    }

    const bytesPerVector = header.dimensions * 4;
    for (;;) {
      // A line break between two entries belongs to no word
      while (pending[position] === LINE_BREAK) {
        position += 1;
      }
      const space = pending.indexOf(SPACE, position);
      if (space < 0 || space + 1 + bytesPerVector > pending.length) {
        break;
      }
      const word = decoder.decode(pending.subarray(position, space));
      // Copy the numbers: the buffer is reused when the next piece arrives
      const vector = new Float32Array(header.dimensions);
      const view = new DataView(pending.buffer, pending.byteOffset + space + 1, bytesPerVector);
      for (let index = 0; index < header.dimensions; index += 1) {
        vector[index] = view.getFloat32(index * 4, true);
      }
      yield { word, vector };
      position = space + 1 + bytesPerVector;
      produced += 1;
      if (produced >= limit) {
        return header;
      }
    }
    pending = pending.slice(position);
  }

  if (header === undefined) {
    throw new Error('The file is empty.');
  }
  return header;
}
