/**
 * Reads the parts of OdeNet, the Open German WordNet (Siegel and Bond 2021, Creative Commons
 * Attribution-ShareAlike 4.0), that the German Word Radar needs: which words exist as ordinary
 * words, of which kind (noun, verb, adjective), and what kind of thing a noun stands for. Used once,
 * by `build-data-de.ts`.
 *
 * OdeNet has fewer relations than the English WordNet (about a third of its senses have a
 * hypernym), so the kind of a noun is found in two ways: every sense of OdeNet carries its English
 * definition, and the same definition in the English WordNet 3.0 tells the kind (the number of its
 * lexicographer file: animal, food, plant ...); a sense without a match takes the kind of its
 * hypernym.
 */

export type PartOfSpeech = 'n' | 'v' | 'a' | 'other';

export interface Synset {
  id: string;
  partOfSpeech: string;
  /** The English definition of the sense */
  description: string;
  hypernyms: string[];
}

export interface Entry {
  /** The word as written, nouns with a capital */
  word: string;
  partOfSpeech: string;
  /** OdeNet marks about 1,400 entries as basic vocabulary */
  basic: boolean;
  /** The ids of the synsets (senses) of this entry */
  senses: string[];
}

export interface OdeNet {
  entries: Entry[];
  synsets: Map<string, Synset>;
}

/** Reads the XML of OdeNet (one entry per line, WN-LMF 1.0). */
export function parseOdeNet(xml: string): OdeNet {
  const synsets = new Map<string, Synset>();
  for (const match of xml.matchAll(
    /<Synset id="([^"]+)" ili="[^"]*" partOfSpeech="([a-z])"([^>]*?)(?:\/>|>([\s\S]*?)<\/Synset>)/g,
  )) {
    const [, id, partOfSpeech, attributes = '', body = ''] = match;
    if (id === undefined || partOfSpeech === undefined) {
      continue;
    }
    synsets.set(id, {
      id,
      partOfSpeech,
      description: /dc:description="([^"]*)"/.exec(attributes)?.[1] ?? '',
      hypernyms: [...body.matchAll(/target='([^']+)' relType='hypernym'/g)].flatMap((hypernym) =>
        hypernym[1] === undefined ? [] : [hypernym[1]],
      ),
    });
  }

  const entries: Entry[] = [];
  for (const match of xml.matchAll(
    /<LexicalEntry id="[^"]*"([^>]*)><Lemma writtenForm="([^"]*)" partOfSpeech="([a-z])"\/>([\s\S]*?)<\/LexicalEntry>/g,
  )) {
    const [, attributes = '', word, partOfSpeech, body = ''] = match;
    if (word === undefined || partOfSpeech === undefined) {
      continue;
    }
    entries.push({
      word,
      partOfSpeech,
      basic: attributes.includes('Basiswortschatz'),
      senses: [...body.matchAll(/<Sense id="[^"]*" synset="([^"]+)"/g)].flatMap((sense) =>
        sense[1] === undefined ? [] : [sense[1]],
      ),
    });
  }
  return { entries, synsets };
}

/** The part of speech of the entry as the game uses it (OdeNet has a few more, such as phrases). */
export function partOfSpeechOf(entry: Entry): PartOfSpeech {
  return entry.partOfSpeech === 'n' || entry.partOfSpeech === 'v' || entry.partOfSpeech === 'a'
    ? entry.partOfSpeech
    : 'other';
}

/**
 * `data.noun` of the English WordNet 3.0: its definitions (the text before the examples) and the
 * kind of each, so that the sense of OdeNet with the same definition gets the same kind. A
 * definition that several senses share with different kinds is not used (it would be a guess).
 */
export function parseNounDefinitions(text: string): Map<string, number> {
  const seen = new Map<string, Set<number>>();
  for (const line of text.split('\n')) {
    if (!/^\d/.test(line)) {
      continue;
    }
    const [head = '', gloss = ''] = line.split(' | ');
    const kind = Number(head.split(' ')[1]);
    const definition = gloss.split(/; "/)[0]?.trim() ?? '';
    if (definition === '' || Number.isNaN(kind)) {
      continue;
    }
    seen.set(definition, new Set([...(seen.get(definition) ?? []), kind]));
  }
  const kinds = new Map<string, number>();
  for (const [definition, set] of seen) {
    const [only] = [...set];
    if (set.size === 1 && only !== undefined) {
      kinds.set(definition, only);
    }
  }
  return kinds;
}

/**
 * The kind of every noun sense that can be told: by its English definition, and then, for the ones
 * left, by the kind of their hypernym (a few rounds, so that a hypernym of a hypernym counts).
 */
export function nounKinds(
  odenet: OdeNet,
  definitions: ReadonlyMap<string, number>,
): Map<string, number> {
  const nouns = [...odenet.synsets.values()].filter((synset) => synset.partOfSpeech === 'n');
  const kinds = new Map<string, number>();
  for (const synset of nouns) {
    const kind = definitions.get(synset.description.trim());
    if (kind !== undefined) {
      kinds.set(synset.id, kind);
    }
  }
  for (let round = 0; round < 6; round += 1) {
    let added = 0;
    for (const synset of nouns) {
      if (kinds.has(synset.id)) {
        continue;
      }
      const inherited = synset.hypernyms
        .map((hypernym) => kinds.get(hypernym))
        .find((kind) => kind !== undefined);
      if (inherited !== undefined) {
        kinds.set(synset.id, inherited);
        added += 1;
      }
    }
    if (added === 0) {
      break;
    }
  }
  return kinds;
}

/**
 * The nouns that share a sense (a synset) with a noun, by lower case word: Gehirn and Hirn are
 * words of one sense. Only single words. OdeNet is not always right (Hund has the insulting words
 * of a sense that is a person), so these are candidates that `chooseSynonyms` checks again.
 */
export function nounSynonyms(odenet: OdeNet): Map<string, Set<string>> {
  const words = new Map<string, Set<string>>();
  for (const entry of odenet.entries) {
    const key = entry.word.toLowerCase();
    if (entry.partOfSpeech !== 'n' || !/^\p{L}+$/u.test(key)) {
      continue;
    }
    for (const sense of entry.senses) {
      words.set(sense, new Set([...(words.get(sense) ?? []), key]));
    }
  }
  const synonyms = new Map<string, Set<string>>();
  for (const group of words.values()) {
    for (const word of group) {
      const others = synonyms.get(word) ?? new Set<string>();
      for (const other of group) {
        if (other !== word) {
          others.add(other);
        }
      }
      synonyms.set(word, others);
    }
  }
  return synonyms;
}
