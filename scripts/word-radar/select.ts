import { nounKinds, type WordNet } from './wordnet.ts';

/** How many words the game knows, and how many of them can be the hidden word. */
export const VOCABULARY_SIZE = 30_000;
export const SECRET_COUNT = 3_000;
/** A hidden word has to be among the commonest words, so that most players know it. */
export const SECRET_RANK_LIMIT = 20_000;

/**
 * Little words that carry no meaning of their own. They are not part of the game: a guess such as
 * "the" would only add noise to the ranking.
 */
const stopWords = new Set(
  `a about above after again against all also am an and any are as at be because been before
  being below between both but by can cannot could did do does doing down during each either else
  few for from further had has have having he her here hers herself him himself his how however i
  if in into is it its itself just let may me might more most much must my myself neither no nor not
  of off on once only onto or other ought our ours ourselves out over own same shall she should so
  some such than that the their theirs them themselves then there these they this those though
  through thus to too under until up upon us very was we were what when where whether which while
  who whom whose why will with within without would yet you your yours yourself yourselves`
    .split(/\s+/)
    .filter(Boolean),
);

export const isStopWord = (word: string): boolean => stopWords.has(word);

/** Whether a word from the GloVe list can be a word of the game. */
export function isVocabularyWord(word: string, wordnet: WordNet): boolean {
  return /^[a-z]{2,15}$/.test(word) && !stopWords.has(word) && wordnet.words.has(word);
}

const kinds = new Set<number>(Object.values(nounKinds));

/**
 * The words that can be hidden: everyday things (animals, objects, food, plants, parts of the
 * body, materials, natural phenomena), common, short enough to be fun, and no names. Whole
 * categories that are full of abstract or sensitive words (people, acts, feelings, ideas) are not
 * included at all, which keeps the list free of offensive words. A short list of words that
 * slip through anyway is in `blocked-secrets.txt`.
 */
export function chooseSecrets(
  vocabulary: readonly string[],
  wordnet: WordNet,
  blocked: ReadonlySet<string> = new Set(),
  count = SECRET_COUNT,
): string[] {
  const secrets: string[] = [];
  for (const [index, word] of vocabulary.entries()) {
    if (index >= SECRET_RANK_LIMIT || secrets.length >= count) {
      break;
    }
    const noun = wordnet.nouns.get(word);
    if (
      noun !== undefined &&
      !blocked.has(word) &&
      noun.tagged >= 1 &&
      kinds.has(noun.kind) &&
      word.length >= 3 &&
      word.length <= 10
    ) {
      secrets.push(word);
    }
  }
  return secrets;
}
