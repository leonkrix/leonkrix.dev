import { describe, expect, it } from 'vitest';

import { readWord2Vec, type WordVector } from './word2vec';

const encoder = new TextEncoder();

/** A word2vec file in the binary format with 3 numbers per word, with or without line breaks. */
function makeFile(
  words: readonly (readonly [string, readonly number[]])[],
  lineBreaks: boolean,
): Uint8Array {
  const parts: Uint8Array[] = [encoder.encode(`${String(words.length)} 3\n`)];
  for (const [word, numbers] of words) {
    parts.push(encoder.encode(`${word} `));
    const bytes = new Uint8Array(12);
    const view = new DataView(bytes.buffer);
    numbers.forEach((value, index) => {
      view.setFloat32(index * 4, value, true);
    });
    parts.push(bytes);
    if (lineBreaks) {
      parts.push(encoder.encode('\n'));
    }
  }
  const all = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  return all;
}

/** The file cut into pieces of `size` bytes, as a read stream would deliver it. */
async function* pieces(file: Uint8Array, size: number): AsyncGenerator<Uint8Array> {
  for (let start = 0; start < file.length; start += size) {
    yield file.slice(start, start + size);
  }
  await Promise.resolve();
}

async function collect(chunks: AsyncIterable<Uint8Array>, limit?: number): Promise<WordVector[]> {
  const found: WordVector[] = [];
  for await (const entry of readWord2Vec(chunks, limit)) {
    found.push(entry);
  }
  return found;
}

const words = [
  ['</s>', [0.5, -0.25, 1]],
  ['Hund', [1, 2, 3]],
  ['Äpfel', [-1.5, 0, 0.125]],
  ['Straße', [4, 5, 6]],
] as const;

describe('readWord2Vec', () => {
  it('reads the words and their numbers, with or without a line break after each vector', async () => {
    for (const lineBreaks of [false, true]) {
      const found = await collect(pieces(makeFile(words, lineBreaks), 1 << 20));
      expect(found.map((entry) => entry.word)).toEqual(['</s>', 'Hund', 'Äpfel', 'Straße']);
      expect([...(found[1]?.vector ?? [])]).toEqual([1, 2, 3]);
      expect([...(found[2]?.vector ?? [])]).toEqual([-1.5, 0, 0.125]);
    }
  });

  it('gives the same result however the file is cut into pieces', async () => {
    const file = makeFile(words, true);
    const whole = await collect(pieces(file, file.length));
    for (const size of [1, 3, 7, 13]) {
      expect(await collect(pieces(file, size))).toEqual(whole);
    }
  });

  it('stops after the limit without reading on', async () => {
    const found = await collect(pieces(makeFile(words, false), 5), 2);
    expect(found.map((entry) => entry.word)).toEqual(['</s>', 'Hund']);
  });

  it('refuses a file that is not in this format', async () => {
    await expect(collect(pieces(encoder.encode('hello world\nmore'), 4))).rejects.toThrow(
      'not a word2vec binary file',
    );
    await expect(collect(pieces(new Uint8Array(0), 4))).rejects.toThrow('empty');
  });
});
