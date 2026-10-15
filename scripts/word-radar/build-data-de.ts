/**
 * Makes the data of the German Word Radar from downloads (see src/games/word-radar/README.md):
 *
 *   data-raw/word-radar/de/nlpl45/model.bin               word vectors, NLPL model 45 (CC BY 4.0)
 *   data-raw/word-radar/de/odenet/odenet_oneline.xml      OdeNet 1.4, the Open German WordNet (CC BY-SA 4.0)
 *   data-raw/word-radar/de/wiktionary/titles.txt          the page titles of the German Wiktionary (CC BY-SA 4.0)
 *   data-raw/word-radar/glove.6B.100d.txt                 GloVe (the same file as for English; only to tell
 *                                                         English words from German ones)
 *   data-raw/word-radar/wordnet/dict/data.noun            WordNet 3.0 (the same file as for English; only
 *                                                         to tell the kind of a noun, see odenet.ts)
 *
 * Run it with `pnpm word-radar-data-de`. The result is committed, so nobody else needs the downloads:
 *
 *   src/games/word-radar/data/de/vocabulary.txt   the 30,000 words of the game (basic words), commonest first
 *   src/games/word-radar/data/de/vectors.bin      64 whole numbers per word (one byte each)
 *   src/games/word-radar/data/de/secrets.txt      the words that can be hidden, each with the words
 *                                                 that mean the same (after a tab, separated by commas)
 *   src/games/word-radar/data/de/forms.txt        inflected forms (Hunde) and the position of their word
 *
 * The files with words were made with OdeNet and the Wiktionary, so they are shared under CC BY-SA 4.0
 * like those (src/games/word-radar/data/de/NOTICE.md); the numbers
 * come from the vectors, which are under CC BY 4.0.
 *
 * Steps: read the commonest 400,000 words of the model; keep those that are a German word (see
 * german.ts: not a little word, not English, not a name) until there are 30,000; shrink the vectors
 * from 100 to 64 numbers with a principal component analysis, make every vector one unit long and
 * store it as whole numbers from -127 to 127 (the same as for English); choose the words that can
 * be hidden.
 */
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  writeFileSync,
} from 'node:fs';

import {
  chooseGermanSecrets,
  chooseGermanVocabulary,
  chooseSynonyms,
  englishWords,
  isEverydayNoun,
  lemmaTable,
  spellingOf,
  thingScorer,
} from './german.ts';
import { nounKinds, nounSynonyms, parseNounDefinitions, parseOdeNet } from './odenet.ts';
import { fitPca, normalize, project, quantize } from './pca.ts';
import { nameSeeds, seedWords } from './seeds-de.ts';
import { VOCABULARY_SIZE } from './select.ts';
import { readWord2Vec } from './word2vec.ts';
import { readWordNet } from './wordnet.ts';

export const DIMENSIONS = 64;
/** How many tokens of the model are looked at (the model has 4.9 million, in the order of their frequency) */
const TOKEN_LIMIT = 400_000;
/** A word that OdeNet does not know needs at least this many letters (shorter ones are mostly foreign) */
const MIN_LENGTH_UNKNOWN = 4;
/** How far down the model forms of the words are looked for (the model has 4.9 million tokens) */
const FORM_LIMIT = 150_000;
/** A synonym of OdeNet has to be this close to the hidden word in the numbers of the game */
const MIN_SYNONYM_SIMILARITY = 0.7;
/** A word that OdeNet does not know and is this close to the examples of names is a name */
const NAME_SCORE = 0.42;

const say = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const RAW = 'data-raw/word-radar';
const OUT = 'src/games/word-radar/data/de';

function requireFile(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. See the "Data" section of src/games/word-radar/README.md.`);
  }
  return path;
}

say('Reading OdeNet, the Wiktionary titles and the English words ...');
const odenet = parseOdeNet(
  readFileSync(requireFile(`${RAW}/de/odenet/odenet_oneline.xml`), 'utf8'),
);
const definitions = parseNounDefinitions(
  readFileSync(requireFile(`${RAW}/wordnet/dict/data.noun`), 'utf8'),
);
const kinds = nounKinds(odenet, definitions);
const table = lemmaTable(odenet);
const titles = new Set(
  readFileSync(requireFile(`${RAW}/de/wiktionary/titles.txt`), 'utf8').split('\n'),
);
const wordnetFile = (name: string): string =>
  readFileSync(requireFile(`${RAW}/wordnet/dict/${name}`), 'utf8');
const wordnet = readWordNet({
  indexNoun: wordnetFile('index.noun'),
  indexVerb: wordnetFile('index.verb'),
  indexAdj: wordnetFile('index.adj'),
  indexAdv: wordnetFile('index.adv'),
  dataNoun: wordnetFile('data.noun'),
});
// The commonest tokens of GloVe (it is sorted by frequency): the little English words and names
const gloveHead = Buffer.alloc(4 << 20);
const gloveFile = openSync(requireFile(`${RAW}/glove.6B.100d.txt`), 'r');
const gloveBytes = readSync(gloveFile, gloveHead, 0, gloveHead.length, 0);
closeSync(gloveFile);
const commonestEnglish = gloveHead
  .subarray(0, gloveBytes)
  .toString('utf8')
  .split('\n')
  .slice(0, 5000)
  .map((line) => line.slice(0, line.indexOf(' ')));
const english = englishWords(wordnet.words, commonestEnglish);
say(
  `  ${String(table.size)} words of OdeNet, ${String(titles.size)} titles, ${String(english.size)} English words`,
);
const examples = new Set(Object.values(seedWords).flat());
const lexicon = { titles, odenet: table, kinds, english, allowed: examples };

say(`Reading the first ${String(TOKEN_LIMIT)} tokens of the model ...`);
const tokens: string[] = [];
const vectors: Float32Array[] = [];
const stream = createReadStream(requireFile(`${RAW}/de/nlpl45/model.bin`), {
  highWaterMark: 1 << 24,
});
for await (const entry of readWord2Vec(stream, TOKEN_LIMIT)) {
  tokens.push(entry.word);
  vectors.push(entry.vector);
}
stream.destroy();
const norms = vectors.map((vector) => Math.hypot(...vector));
const indexOfToken = new Map(tokens.map((token, index) => [token, index]));
const vectorOfToken = (word: string): Float32Array | undefined =>
  vectors[indexOfToken.get(word) ?? -1];

function similarity(a: number, b: number): number {
  const first = vectors[a];
  const second = vectors[b];
  if (first === undefined || second === undefined) {
    return 0;
  }
  let dot = 0;
  for (let index = 0; index < first.length; index += 1) {
    dot += (first[index] ?? 0) * (second[index] ?? 0);
  }
  return dot / ((norms[a] ?? 1) * (norms[b] ?? 1) || 1);
}

say('Choosing the words ...');
// The average of the commonest words, taken away before words are compared with examples: the
// commonest words share a direction in the numbers, which makes every one of them look a little
// like every kind of word
const center = new Float32Array(vectors[0]?.length ?? 0);
const CENTER_WORDS = 50_000;
for (const vector of vectors.slice(0, CENTER_WORDS)) {
  vector.forEach((value, index) => {
    center[index] = (center[index] ?? 0) + value / CENTER_WORDS;
  });
}
const nameScore = thingScorer(nameSeeds, vectorOfToken, center);
/** A token as a word of the game, or undefined: no foreign short word, no name, no English word */
function spell(token: string): string | undefined {
  const spelling = spellingOf(token, lexicon);
  if (spelling === undefined || table.has(token) || examples.has(token)) {
    return spelling;
  }
  return token.length >= MIN_LENGTH_UNKNOWN && nameScore(token) < NAME_SCORE ? spelling : undefined;
}
const { words, forms } = chooseGermanVocabulary(
  tokens,
  similarity,
  spell,
  VOCABULARY_SIZE,
  FORM_LIMIT,
);
if (words.length < VOCABULARY_SIZE) {
  throw new Error(`Only ${String(words.length)} words found, expected ${String(VOCABULARY_SIZE)}.`);
}
const lastToken = tokens.indexOf(words.at(-1)?.key ?? '');
say(
  `  ${String(words.length)} words, the last one is "${words.at(-1)?.display ?? ''}" at position ${String(lastToken)} of the model; ${String(forms.length)} forms of them`,
);

say('Analysing the vectors (principal components) ...');
const rows = words.map((word) => vectors[indexOfToken.get(word.key) ?? -1] ?? new Float32Array(0));
const projection = fitPca(rows, DIMENSIONS);
const explained = projection.explained.reduce((sum, value) => sum + value, 0);
say(`  ${String(DIMENSIONS)} directions keep ${(explained * 100).toFixed(1)} % of the variation`);

// The numbers of the game: one unit long. Words are compared by them (the synonyms below)
const unit = rows.map((row) => normalize(project(row, projection)));
const bytes = new Int8Array(words.length * DIMENSIONS);
for (const [index, vector] of unit.entries()) {
  bytes.set(quantize(vector), index * DIMENSIONS);
}
const wordIndex = new Map(words.map((word, index) => [word.key, index]));
const similarityOfWords = (a: string, b: string): number => {
  const first = unit[wordIndex.get(a) ?? -1];
  const second = unit[wordIndex.get(b) ?? -1];
  if (first === undefined || second === undefined) {
    return -1;
  }
  return first.reduce((sum, value, index) => sum + value * (second[index] ?? 0), 0);
};

const wordList = (file: string): string[] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .flatMap((line) => line.split(/\s+/))
    .filter(Boolean)
    .map((word) => word.toLowerCase());
const blocked = new Set(wordList('scripts/word-radar/blocked-secrets-de.txt'));
const score = thingScorer(seedWords, vectorOfToken, center);
const everyday = (key: string): boolean =>
  table.get(key)?.entries.some((entry) => isEverydayNoun(entry, kinds)) ?? false;
const secrets = chooseGermanSecrets(words, score, everyday, blocked, {
  rankLimit: 20_000,
  count: 3_000,
  minLength: 3,
  maxLength: 12,
  minScore: 0.5,
  minScoreWithOdenet: 0.33,
  // The examples of things are always allowed (when they are in the list and not blocked)
  allowed: examples,
});
say(`  ${String(secrets.length)} words that can be hidden`);

// Words that mean the same as a hidden word, and count as finding it: "- secret word" in the file
// takes a pair away, "+ secret word" adds one
const removed = new Set<string>();
const added: [string, string][] = [];
for (const line of readFileSync('scripts/word-radar/synonyms-de.txt', 'utf8').split('\n')) {
  const [sign, secret, word] = line.trim().split(/\s+/);
  if (sign === '-' && secret !== undefined && word !== undefined) {
    removed.add(`${secret.toLowerCase()}>${word.toLowerCase()}`);
  } else if (sign === '+' && secret !== undefined && word !== undefined) {
    added.push([secret.toLowerCase(), word.toLowerCase()]);
  }
}
const synonymTable = nounSynonyms(odenet);
const synonyms = chooseSynonyms(
  secrets.map((secret) => secret.toLowerCase()),
  (key) => [...(synonymTable.get(key) ?? [])],
  (key) => wordIndex.has(key),
  similarityOfWords,
  { minSimilarity: MIN_SYNONYM_SIMILARITY, removed, added },
);
say(`  ${String(synonyms.size)} hidden words have synonyms`);
const secretLines = secrets.map((secret) => {
  const own = synonyms.get(secret.toLowerCase()) ?? [];
  const shown = own.map((key) => words[wordIndex.get(key) ?? -1]?.display ?? key);
  return shown.length === 0 ? secret : `${secret}\t${shown.join(',')}`;
});

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/vocabulary.txt`, `${words.map((word) => word.display).join('\n')}\n`);
writeFileSync(`${OUT}/vectors.bin`, Buffer.from(bytes.buffer));
writeFileSync(`${OUT}/secrets.txt`, `${secretLines.join('\n')}\n`);
// A form and the position of its word in the list
writeFileSync(
  `${OUT}/forms.txt`,
  `${forms.map((form) => `${form.display}\t${String(wordIndex.get(form.lemma))}`).join('\n')}\n`,
);
say(`Written to ${OUT}/`);
