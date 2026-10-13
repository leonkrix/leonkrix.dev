/**
 * Makes the data of Word Radar from two downloads (see src/games/word-radar/README.md):
 *
 *   data-raw/word-radar/glove.6B.100d.txt     GloVe word vectors (Stanford, public domain)
 *   data-raw/word-radar/wordnet/dict/         WordNet 3.0 (Princeton University, WordNet License)
 *
 * Run it with `pnpm word-radar-data`. The result is committed, so nobody else needs the downloads:
 *
 *   src/games/word-radar/data/vocabulary.txt  the 30,000 words of the game, commonest first
 *   src/games/word-radar/data/vectors.bin     64 whole numbers per word (one byte each)
 *   src/games/word-radar/data/secrets.txt     the words that can be hidden
 *
 * Steps: read GloVe from the top (the file is sorted by how common a word is) and keep the words
 * that are ordinary words in WordNet and no stop words, until there are 30,000; shrink the vectors
 * from 100 to 64 numbers with a principal component analysis (the strongest directions of the
 * words); make every vector one unit long (so that a dot product is the cosine similarity) and
 * store it as whole numbers from -127 to 127; choose the words that can be hidden.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

import { fitPca, normalize, project, quantize } from './pca.ts';
import { chooseSecrets, isVocabularyWord, VOCABULARY_SIZE } from './select.ts';
import { readWordNet } from './wordnet.ts';

export const DIMENSIONS = 64;

const say = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const RAW = 'data-raw/word-radar';
const OUT = 'src/games/word-radar/data';

function requireFile(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. See the "Data" section of src/games/word-radar/README.md.`);
  }
  return path;
}

const wordnetFile = (name: string): string =>
  readFileSync(requireFile(`${RAW}/wordnet/dict/${name}`), 'utf8');

say('Reading WordNet ...');
const wordnet = readWordNet({
  indexNoun: wordnetFile('index.noun'),
  indexVerb: wordnetFile('index.verb'),
  indexAdj: wordnetFile('index.adj'),
  indexAdv: wordnetFile('index.adv'),
  dataNoun: wordnetFile('data.noun'),
});
say(`  ${String(wordnet.words.size)} ordinary words, ${String(wordnet.nouns.size)} nouns`);

say('Reading GloVe ...');
const words: string[] = [];
const rows: Float32Array[] = [];
const lines = createInterface({
  input: createReadStream(requireFile(`${RAW}/glove.6B.100d.txt`)),
  crlfDelay: Infinity,
});
for await (const line of lines) {
  const space = line.indexOf(' ');
  const word = line.slice(0, space);
  if (isVocabularyWord(word, wordnet)) {
    words.push(word);
    rows.push(Float32Array.from(line.slice(space + 1).split(' '), Number));
    if (words.length === VOCABULARY_SIZE) {
      lines.close();
      break;
    }
  }
}
if (words.length < VOCABULARY_SIZE) {
  throw new Error(`Only ${String(words.length)} words found, expected ${String(VOCABULARY_SIZE)}.`);
}
say(`  ${String(words.length)} words, the last one is "${words.at(-1) ?? ''}"`);

say('Analysing the vectors (principal components) ...');
const projection = fitPca(rows, DIMENSIONS);
const explained = projection.explained.reduce((sum, value) => sum + value, 0);
say(`  ${String(DIMENSIONS)} directions keep ${(explained * 100).toFixed(1)} % of the variation`);

const bytes = new Int8Array(words.length * DIMENSIONS);
for (const [index, row] of rows.entries()) {
  bytes.set(quantize(normalize(project(row, projection))), index * DIMENSIONS);
}

const blocked = new Set(
  readFileSync('scripts/word-radar/blocked-secrets.txt', 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .flatMap((line) => line.split(/\s+/))
    .filter(Boolean),
);
const secrets = chooseSecrets(words, wordnet, blocked);
say(`  ${String(secrets.length)} words that can be hidden`);

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/vocabulary.txt`, `${words.join('\n')}\n`);
writeFileSync(`${OUT}/vectors.bin`, Buffer.from(bytes.buffer));
writeFileSync(`${OUT}/secrets.txt`, `${secrets.join('\n')}\n`);
say(`Written to ${OUT}/`);
