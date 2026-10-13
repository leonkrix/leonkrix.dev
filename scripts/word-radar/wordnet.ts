/**
 * Reads the parts of WordNet 3.0 (Princeton University, WordNet License) that Word Radar needs:
 * which words exist as ordinary words (and not only as names), and what kind of thing a noun
 * stands for. Used once, by `build-data.ts`.
 */

/** The number of the lexicographer file of nouns (`dict/data.noun`, second column). */
export const nounKinds = {
  animal: 5,
  artifact: 6,
  body: 8,
  food: 13,
  object: 17,
  phenomenon: 19,
  plant: 20,
  substance: 27,
} as const;

export interface NounInfo {
  /** How often the senses of the word were found in a text collection: a measure of how common it is */
  tagged: number;
  /** The kind (lexicographer file) of its most common sense */
  kind: number;
}

export interface WordNet {
  /** Single, lower case words that are an ordinary word of any kind (a word that is only a name is not in it) */
  words: ReadonlySet<string>;
  nouns: ReadonlyMap<string, NounInfo>;
}

const isEntry = (line: string): boolean => /^\S/.test(line);

/** `index.<kind>`: the words of one kind with the senses of each. */
export function parseIndex(text: string): { word: string; tagged: number; first: string }[] {
  const entries: { word: string; tagged: number; first: string }[] = [];
  for (const line of text.split('\n')) {
    if (!isEntry(line)) {
      continue;
    }
    const parts = line.trim().split(/\s+/);
    const pointers = Number(parts[3]);
    // word, kind, synset count, pointer count, the pointers, sense count, tagged count, offsets
    const tagged = Number(parts[4 + pointers + 1]);
    const first = parts[4 + pointers + 2];
    if (parts[0] === undefined || first === undefined || Number.isNaN(tagged)) {
      continue;
    }
    entries.push({ word: parts[0], tagged, first });
  }
  return entries;
}

/** `data.noun`: for each sense its kind and the forms of its words (names start with a capital). */
export function parseNounData(text: string): Map<string, { kind: number; forms: string[] }> {
  const senses = new Map<string, { kind: number; forms: string[] }>();
  for (const line of text.split('\n')) {
    if (!isEntry(line)) {
      continue;
    }
    const parts = line.split(' | ')[0]?.trim().split(/\s+/) ?? [];
    const offset = parts[0];
    const kind = Number(parts[1]);
    const count = Number.parseInt(parts[3] ?? '', 16);
    if (offset === undefined || Number.isNaN(kind) || Number.isNaN(count)) {
      continue;
    }
    const forms: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const form = parts[4 + index * 2];
      if (form !== undefined) {
        forms.push(form);
      }
    }
    senses.set(offset, { kind, forms });
  }
  return senses;
}

const isPlain = (word: string): boolean => /^[a-z]+$/.test(word);

/** Everything the game needs from the unpacked `dict` folder, given as the texts of the files. */
export function readWordNet(files: {
  indexNoun: string;
  indexVerb: string;
  indexAdj: string;
  indexAdv: string;
  dataNoun: string;
}): WordNet {
  const senses = parseNounData(files.dataNoun);
  const words = new Set<string>();
  const nouns = new Map<string, NounInfo>();

  for (const entry of parseIndex(files.indexNoun)) {
    if (!isPlain(entry.word)) {
      continue;
    }
    const sense = senses.get(entry.first);
    // A noun whose most common sense is written with a capital is a name (London, Mary)
    if (sense === undefined || !isOrdinary(entry.word, senses, entry.first)) {
      continue;
    }
    words.add(entry.word);
    nouns.set(entry.word, { tagged: entry.tagged, kind: sense.kind });
  }
  for (const text of [files.indexVerb, files.indexAdj, files.indexAdv]) {
    for (const entry of parseIndex(text)) {
      if (isPlain(entry.word)) {
        words.add(entry.word);
      }
    }
  }
  return { words, nouns };
}

/** Whether the word is written without a capital in the first (most common) sense it has. */
function isOrdinary(
  word: string,
  senses: ReadonlyMap<string, { kind: number; forms: string[] }>,
  first: string,
): boolean {
  const forms = senses.get(first)?.forms ?? [];
  return forms.some((form) => form === word);
}
