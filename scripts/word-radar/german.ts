/**
 * The choice of the words of the German Word Radar (used once, by `build-data-de.ts`).
 *
 * The vectors are one number list per word as it appears in the text, all in lower case (the
 * NLPL model 45), so the words of the game are the lower case tokens of that model that are a
 * German word: they have a page in the German Wiktionary (a list of its titles, which also gives
 * the capital letters of nouns and has the inflected forms, Hund and Hunde) or are a word of OdeNet,
 * and they are not a little word and not English (a word of the English list that OdeNet does not
 * know). The game shows nouns with a capital letter, as German is written; typing accepts any case.
 *
 * Which of the words are inflected forms is not in the lists, so it is worked out: a word is a form
 * of another when an ending (or an umlaut and an ending) turns the other into it and the two are
 * close in meaning. A form is a valid guess but is never hidden.
 */
import { type Entry, type OdeNet, type PartOfSpeech, partOfSpeechOf } from './odenet.ts';

/** A token of the model that can be a word of the game: three to 25 letters, German ones included */
export const GERMAN_WORD = /^[a-zäöüß]{3,25}$/;

/**
 * Little words that carry no meaning of their own (articles, pronouns, prepositions, conjunctions,
 * auxiliary and modal verbs, the commonest adverbs). They are not part of the game: a guess such
 * as "und" would only add noise to the ranking.
 */
const stopWords = new Set(
  `aber alle allem allen aller alles als also am an andere anderen anderer anderes auch auf aus
  außer bei beim bin bis bist da dabei dadurch dafür dagegen daher dahin damit danach dann daran
  darauf daraus darin darüber darum darunter das dass dazu dein deine deinen deiner dem den denn
  der des deshalb dich die dies diese diesem diesen dieser dieses dir doch dort drei du durch
  dürfen ebenfalls ebenso ein eine einem einen einer eines einmal er es etwa etwas euch euer eure
  für gegen gewesen habe haben hast hat hatte hatten hattest hier hin hinter ich ihm ihn ihnen ihr
  ihre ihrem ihren ihrer ihres im immer in indem ins ist ja jede jedem jeden jeder jedes jedoch
  jemand jetzt kann kannst kein keine keinem keinen keiner können könnte machen man manche manchem
  manchen mancher mehr mein meine meinem meinen meiner mich mir mit muss musst müssen müsste nach
  nachdem neben nein nicht nichts noch nun nur ob oben oder ohne sehr sein seine seinem seinen
  seiner seit seitdem selbst sich sie sind so solche solchen solcher sollen sollte sondern sonst
  soweit sowie über um und uns unser unsere unserem unseren unter viel viele vielen vom von vor
  während war waren warst was weder weil weiter welche welchem welchen welcher welches wenn wer
  werde werden werdet wie wieder will willst wir wird wirst wo wollen wollte worden wurde wurden
  würde würden zu zum zur zwar zwischen`
    .split(/\s+/)
    .filter(Boolean),
);

export const isGermanStopWord = (word: string): boolean => stopWords.has(word);

export const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** The last a, o or u of a word with an umlaut (Hand to Hände, Haus to Häuser), if it has one */
function withUmlaut(word: string): string | undefined {
  const replace: Record<string, string> = { a: 'ä', o: 'ö', u: 'ü' };
  for (let index = word.length - 1; index >= 0; index -= 1) {
    const letter = word[index] ?? '';
    if (letter in replace) {
      // In "au" it is the a that gets the umlaut (Haus, Häuser)
      const at = letter === 'u' && word[index - 1] === 'a' ? index - 1 : index;
      return `${word.slice(0, at)}${replace[word[at] ?? ''] ?? ''}${word.slice(at + 1)}`;
    }
  }
  return undefined;
}

/**
 * The forms of a word that a text can have: endings of nouns (plural, genitive), adjectives
 * (declension, comparative and superlative) and verbs (present, past, participle). Irregular
 * forms (lief, ging) are not found, which is fine: the player gets the message to try the basic form.
 */
export function inflectedForms(word: string, partOfSpeech: PartOfSpeech): string[] {
  const forms: string[] = [];
  if (partOfSpeech === 'n') {
    const umlaut = withUmlaut(word);
    forms.push(...['e', 'en', 'n', 's', 'es', 'er', 'ern'].map((ending) => word + ending));
    if (umlaut !== undefined) {
      forms.push(umlaut, ...['e', 'er', 'ern', 'n', 'en'].map((ending) => umlaut + ending));
    }
  } else if (partOfSpeech === 'a') {
    for (const ending of ['e', 'en', 'er', 'es', 'em']) {
      forms.push(word + ending, `${word}er${ending}`, `${word}st${ending}`);
    }
    forms.push(`${word}er`, `${word}ste`, `${word}sten`);
  } else if (partOfSpeech === 'v' && word.endsWith('en') && word.length > 4) {
    const stem = word.slice(0, -2);
    for (const ending of ['e', 'st', 't', 'et', 'te', 'ten', 'test', 'tet', 'end']) {
      forms.push(stem + ending);
    }
    forms.push(`ge${stem}t`, `ge${stem}et`);
  }
  return forms.filter((form) => GERMAN_WORD.test(form));
}

/** What OdeNet knows about a word, written in lower case (the key of the model) */
export interface LemmaInfo {
  key: string;
  entries: readonly Entry[];
}

/** Every word of OdeNet that is a single word of letters, by its lower case form. */
export function lemmaTable(odenet: OdeNet): Map<string, LemmaInfo> {
  const grouped = new Map<string, Entry[]>();
  for (const entry of odenet.entries) {
    const key = entry.word.toLowerCase();
    if (!GERMAN_WORD.test(key) || stopWords.has(key)) {
      continue;
    }
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }
  return new Map([...grouped].map(([key, entries]) => [key, { key, entries }]));
}

/** The kinds that a hidden word may have been (the same ones as in the English game) */
export const hiddenKinds: ReadonlySet<number> = new Set([5, 6, 8, 13, 17, 19, 20, 27]);

/**
 * Whether a noun of OdeNet has a sense that is an everyday thing (an animal, an object, food, a
 * plant, a part of the body, a material, a natural phenomenon). OdeNet is not always right (the
 * "Macht" has a sense of a starch), so this is only one of two proofs for a hidden word.
 */
export function isEverydayNoun(entry: Entry, kinds: ReadonlyMap<string, number>): boolean {
  return (
    entry.partOfSpeech === 'n' &&
    entry.senses.some((sense) => hiddenKinds.has(kinds.get(sense) ?? -1))
  );
}

/** How a word of OdeNet is written in the game: nouns with a capital letter, the rest as OdeNet writes it. */
export function odenetSpelling(info: LemmaInfo, kinds: ReadonlyMap<string, number>): string {
  const everyday = info.entries.find((entry) => isEverydayNoun(entry, kinds));
  if (everyday !== undefined) {
    return everyday.word;
  }
  const other = info.entries.find((entry) => partOfSpeechOf(entry) !== 'n');
  if (other !== undefined) {
    return other.word;
  }
  return info.entries[0]?.word ?? info.key;
}

export interface Lexicon {
  /** The titles of the German Wiktionary, as they are written (capitals included) */
  titles: ReadonlySet<string>;
  /** The words of OdeNet */
  odenet: ReadonlyMap<string, LemmaInfo>;
  kinds: ReadonlyMap<string, number>;
  /** English words (see `englishWords`): such a word that is in no German list is English */
  english: ReadonlySet<string>;
  /** Words that are never English, whatever the English list says (our own examples: Spiegel) */
  allowed?: ReadonlySet<string>;
}

/**
 * How a token of the model is written in the game, or undefined when it is no word of the game.
 * A word of OdeNet is written as OdeNet writes it. Another word needs a title in the Wiktionary,
 * written with a capital letter if only that exists (a noun) and, if both exist, as a noun. A word
 * of the English list that OdeNet does not know is English and left out.
 */
export function spellingOf(token: string, lexicon: Lexicon): string | undefined {
  if (!GERMAN_WORD.test(token) || stopWords.has(token)) {
    return undefined;
  }
  const info = lexicon.odenet.get(token);
  if (info !== undefined) {
    return odenetSpelling(info, lexicon.kinds);
  }
  const lower = lexicon.titles.has(token);
  const upper = lexicon.titles.has(capitalize(token));
  const isEnglish = lexicon.english.has(token) && lexicon.allowed?.has(token) !== true;
  if (isEnglish || (!lower && !upper)) {
    return undefined;
  }
  return upper ? capitalize(token) : token;
}

export interface GermanWord {
  /** The token of the model (lower case) */
  key: string;
  /** The word as shown in the game */
  display: string;
}

/** An inflected form of a word of the game: typing it counts as typing the word. */
export interface GermanForm {
  key: string;
  display: string;
  /** The key of the word of the game this is a form of */
  lemma: string;
}

export interface GermanVocabulary {
  /** The words of the game (basic words only), commonest first */
  words: GermanWord[];
  /** Their inflected forms, commonest first */
  forms: GermanForm[];
}

/**
 * How close a form has to be to its word in meaning (the cosine of their vectors). Measured:
 * Hund and Hunde 0.72, Haus and Häuser 0.61, but also Kauf and kaufen 0.56 (a noun and a verb that
 * only look alike), so nouns need 0.6. The forms of an adjective (neu and neue 0.57, alt and alte
 * 0.53) and of a verb (sehen and sehe 0.61) are a little further away, so they need less.
 */
export const FORM_SIMILARITY: Readonly<Record<PartOfSpeech, number>> = {
  n: 0.6,
  a: 0.5,
  v: 0.55,
  other: 0.6,
};

/** The part of speech by which the forms of a word are made: nouns have a capital letter */
function kindOfSpelling(display: string, key: string): PartOfSpeech {
  if (/^\p{Lu}/u.test(display)) {
    return 'n';
  }
  return key.endsWith('en') ? 'v' : 'a';
}

/**
 * The words of the game and their forms. The words are the tokens of the model that are a German
 * word (see `spellingOf`) and no form of another word, commonest first, until there are `size`.
 * A form (Hunde, Hundes) is not a word of the game: it is kept in a list of its own, and typing it
 * counts as typing its word, so that the ranking, the hints and the list of the nearest words
 * show basic words only. `tokens` is the model in the order of its frequency, `similarity(a, b)`
 * the cosine of two of its tokens (by position), `formLimit` how far down the model forms are looked for.
 */
export function chooseGermanVocabulary(
  tokens: readonly string[],
  similarity: (a: number, b: number) => number,
  spell: (token: string) => string | undefined,
  size: number,
  formLimit = Number.POSITIVE_INFINITY,
): GermanVocabulary {
  const indexOf = new Map(tokens.map((token, index) => [token, index]));
  const spelling = new Map<string, string>();
  for (const token of tokens) {
    const display = spell(token);
    if (display !== undefined) {
      spelling.set(token, display);
    }
  }

  // The forms of the words: form -> the word it was made from
  const formOf = new Map<string, string>();
  for (const [key, display] of spelling) {
    const base = indexOf.get(key);
    if (base === undefined) {
      continue;
    }
    const kind = kindOfSpelling(display, key);
    for (const form of inflectedForms(key, kind)) {
      const at = indexOf.get(form);
      if (
        at !== undefined &&
        spelling.has(form) &&
        !formOf.has(form) &&
        similarity(base, at) >= FORM_SIMILARITY[kind]
      ) {
        formOf.set(form, key);
      }
    }
  }
  // A form of a form (the word of a word) belongs to the word at the end of the chain
  const rootOf = (token: string): string => {
    let current = token;
    for (let step = 0; step < 5; step += 1) {
      const next = formOf.get(current);
      if (next === undefined) {
        return current;
      }
      current = next;
    }
    return current;
  };

  // Two spellings of the same word (Straße and Strasse, with the sharp s or without) are one word:
  // the commoner one stays (typing finds it either way, see `spellings` in the game)
  const seen = new Set<string>();
  const words: GermanWord[] = [];
  const chosen = new Set<string>();
  for (const token of tokens) {
    const spelled = spelling.get(token);
    const norm = token.replaceAll('ß', 'ss');
    if (spelled === undefined || formOf.has(token) || seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    words.push({ key: token, display: spelled });
    chosen.add(token);
    if (words.length === size) {
      break;
    }
  }

  const forms: GermanForm[] = [];
  for (const token of tokens.slice(0, formLimit)) {
    const spelled = spelling.get(token);
    if (spelled === undefined || !formOf.has(token) || seen.has(token.replaceAll('ß', 'ss'))) {
      continue;
    }
    const lemma = rootOf(token);
    if (!chosen.has(lemma)) {
      continue;
    }
    // A form is written like its word: a noun with a capital letter, an adjective or verb without
    // (the Wiktionary has pages for both "neue" and "Neue")
    const display = /^\p{Lu}/u.test(spelling.get(lemma) ?? '') ? capitalize(token) : token;
    forms.push({ key: token, display, lemma });
  }
  return { words, forms };
}

export interface SecretOptions {
  rankLimit: number;
  count: number;
  minLength: number;
  maxLength: number;
  /** How close to the examples of the kinds a word has to be (see `seeds-de.ts`) */
  minScore: number;
  /** The same, for a word that OdeNet also says is an everyday thing: less is enough */
  minScoreWithOdenet: number;
  /** Words that are always good (our own examples of things): they need no closeness */
  allowed?: ReadonlySet<string>;
}

/**
 * The words that can be hidden: nouns (written with a capital letter), common
 * and not too long, that are everyday things. Two proofs work together: the numbers of the word
 * are close to the examples of a kind of thing (`score`), and OdeNet may confirm it (`everyday`).
 * A word that OdeNet knows as an everyday thing needs less closeness, any other word needs more.
 * A short list of words that slip through anyway is in `blocked-secrets-de.txt`.
 */
export function chooseGermanSecrets(
  vocabulary: readonly GermanWord[],
  score: (key: string) => number,
  everyday: (key: string) => boolean,
  blocked: ReadonlySet<string>,
  options: SecretOptions,
): string[] {
  const secrets: string[] = [];
  for (const [index, word] of vocabulary.entries()) {
    if (index >= options.rankLimit || secrets.length >= options.count) {
      break;
    }
    if (
      !/^\p{Lu}/u.test(word.display) ||
      blocked.has(word.key) ||
      word.key.length < options.minLength ||
      word.key.length > options.maxLength
    ) {
      continue;
    }
    const needed = everyday(word.key) ? options.minScoreWithOdenet : options.minScore;
    if (options.allowed?.has(word.key) === true || score(word.key) >= needed) {
      secrets.push(word.display);
    }
  }
  return secrets;
}

/**
 * The closeness of a word to the kinds of things: the example words of each kind are averaged (their
 * numbers added and made one unit long), and the score of a word is its cosine with the nearest of
 * those averages. `vectorOf` gives the numbers of a word, or undefined if the word is not known.
 * `center` is the average of all words, taken away from every vector first: the commonest words
 * share a direction in the numbers, which would make every common word look a little like every
 * kind of thing.
 */
export function thingScorer(
  seeds: Readonly<Record<string, readonly string[]>>,
  vectorOf: (word: string) => Float32Array | undefined,
  center?: Float32Array,
): (key: string) => number {
  /** One unit long */
  const normalize = (vector: Float32Array): Float32Array => {
    const length = Math.hypot(...vector) || 1;
    return vector.map((value) => value / length);
  };
  /** The numbers of a word without the common part, one unit long */
  const unit = (vector: Float32Array): Float32Array =>
    normalize(
      center === undefined ? vector : vector.map((value, index) => value - (center[index] ?? 0)),
    );
  const centroids = Object.values(seeds).map((words) => {
    const vectors = words.flatMap((word) => {
      const vector = vectorOf(word);
      return vector === undefined ? [] : [unit(vector)];
    });
    const sum = new Float32Array(vectors[0]?.length ?? 0);
    for (const vector of vectors) {
      vector.forEach((value, index) => {
        sum[index] = (sum[index] ?? 0) + value;
      });
    }
    return normalize(sum);
  });
  return (key) => {
    const vector = vectorOf(key);
    if (vector === undefined) {
      return -1;
    }
    const word = unit(vector);
    return centroids.reduce((best, centroid) => {
      let dot = 0;
      for (let index = 0; index < word.length; index += 1) {
        dot += (word[index] ?? 0) * (centroid[index] ?? 0);
      }
      return Math.max(best, dot);
    }, -1);
  };
}

/**
 * The English words that must not get into the German game: the words of the English WordNet with
 * their regular forms (wines, lamps, priced, bottled, quickly) and the commonest words of English
 * texts (the little words, and names such as Larry or Sudan). Only these: GloVe knows much more,
 * German words and names from the English texts it was made of, so a longer list would take Kuh
 * and Honig.
 */
export function englishWords(
  wordnet: ReadonlySet<string>,
  commonest: readonly string[],
): Set<string> {
  const english = new Set<string>();
  const add = (word: string): void => {
    english.add(word);
  };
  for (const word of wordnet) {
    add(word);
    for (const ending of ['s', 'es', 'ed', 'd', 'ing', 'ly', 'er', 'ers']) {
      add(word + ending);
    }
    if (word.endsWith('e')) {
      add(`${word.slice(0, -1)}ing`);
    }
    if (word.endsWith('y')) {
      add(`${word.slice(0, -1)}ies`);
      add(`${word.slice(0, -1)}ied`);
    }
  }
  for (const word of commonest) {
    add(word);
  }
  return english;
}

/**
 * The words that mean the same as a hidden word, so that a guess of one of them counts as finding
 * it (Hirn for Gehirn). OdeNet says which words mean the same (`synonymsOf`: its words of the same
 * sense), but it is not always right (the synonyms of Hund include Arschloch and Schwein, of
 * Fahrrad Hirsch), so a word also has to be close to the hidden word in the numbers of the game
 * (`minSimilarity`). A pair that is wrong anyway is in `removed` ("secret>synonym", lower case), a
 * pair that is right but not close enough is in `added`. Words are keys (lower case), a synonym
 * has to be a word of the game.
 */
export function chooseSynonyms(
  secrets: readonly string[],
  synonymsOf: (key: string) => readonly string[],
  isWord: (key: string) => boolean,
  similarity: (a: string, b: string) => number,
  options: {
    minSimilarity: number;
    removed?: ReadonlySet<string>;
    added?: readonly (readonly [string, string])[];
  },
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const secret of secrets) {
    const synonyms = synonymsOf(secret)
      .filter(
        (word) =>
          word !== secret &&
          isWord(word) &&
          options.removed?.has(`${secret}>${word}`) !== true &&
          similarity(secret, word) >= options.minSimilarity,
      )
      .sort((a, b) => similarity(secret, b) - similarity(secret, a));
    if (synonyms.length > 0) {
      found.set(secret, [...new Set(synonyms)]);
    }
  }
  for (const [secret, word] of options.added ?? []) {
    if (secrets.includes(secret) && isWord(word) && word !== secret) {
      const list = found.get(secret) ?? [];
      if (!list.includes(word)) {
        found.set(secret, [...list, word]);
      }
    }
  }
  return found;
}
