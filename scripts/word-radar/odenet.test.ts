import { describe, expect, it } from 'vitest';

import {
  nounKinds,
  nounSynonyms,
  parseNounDefinitions,
  parseOdeNet,
  partOfSpeechOf,
} from './odenet';

// A sample in the real format of odenet_oneline.xml (shortened)
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<LexicalResource><Lexicon id="odenet">
<LexicalEntry id="w1" dc:type="Basiswortschatz" confidenceScore="1.0"><Lemma writtenForm="Hund" partOfSpeech="n"/><Sense id="w1_1-n" synset="odenet-1-n"/></LexicalEntry>
<LexicalEntry id="w2"><Lemma writtenForm="Rüde" partOfSpeech="n"/><Sense id="w2_2-n" synset="odenet-2-n"/></LexicalEntry>
<LexicalEntry id="w3"><Lemma writtenForm="Idee" partOfSpeech="n"/><Sense id="w3_3-n" synset="odenet-3-n"/></LexicalEntry>
<LexicalEntry id="w4"><Lemma writtenForm="laufen" partOfSpeech="v"/><Sense id="w4_4-v" synset="odenet-4-v"/></LexicalEntry>
<LexicalEntry id="w5"><Lemma writtenForm="schön" partOfSpeech="a"/><Sense id="w5_5-a" synset="odenet-5-a"/><Sense id="w5_6-a" synset="odenet-6-a"/></LexicalEntry>
</Lexicon>
<Synset id="odenet-1-n" ili="i1" partOfSpeech="n" dc:description="a member of the genus Canis"><SynsetRelation target='odenet-9-n' relType='hypernym'/></Synset>
<Synset id="odenet-2-n" ili="" partOfSpeech="n"><SynsetRelation target='odenet-1-n' relType='hypernym'/><SynsetRelation target='odenet-8-n' relType='hyponym'/></Synset>
<Synset id="odenet-3-n" ili="i3" partOfSpeech="n" dc:description="a personal view"/>
<Synset id="odenet-4-v" ili="i4" partOfSpeech="v" dc:description="move fast by using one's feet"/>
<Synset id="odenet-9-n" ili="i9" partOfSpeech="n" dc:description="a living organism"></Synset>
</LexicalResource>`;

// A sample of data.noun of the English WordNet 3.0
const DATA_NOUN = [
  '  1 This software and database is being provided to you',
  '00001740 03 n 01 entity 0 003 ~ 00001930 n 0000 | that which is perceived or known; "the entity"',
  '02084071 05 n 01 dog 0 003 @ 02083346 n 0000 | a member of the genus Canis; "the dog barked"',
  '05842164 09 n 01 idea 0 001 @ 05841000 n 0000 | a personal view',
  '00000001 05 n 01 organism 0 001 @ 00000002 n 0000 | a living organism',
  '00000003 06 n 01 thing 0 001 @ 00000002 n 0000 | something shared',
  '00000004 09 n 01 notion 0 001 @ 00000002 n 0000 | something shared',
].join('\n');

describe('parseOdeNet', () => {
  const odenet = parseOdeNet(XML);

  it('reads the entries with their part of speech, the basic vocabulary mark and the senses', () => {
    expect(odenet.entries.map((entry) => entry.word)).toEqual([
      'Hund',
      'Rüde',
      'Idee',
      'laufen',
      'schön',
    ]);
    const hund = odenet.entries[0];
    expect(hund).toMatchObject({ partOfSpeech: 'n', basic: true, senses: ['odenet-1-n'] });
    expect(odenet.entries[1]?.basic).toBe(false);
    expect(odenet.entries[4]?.senses).toEqual(['odenet-5-a', 'odenet-6-a']);
  });

  it('reads the synsets with their English definition and their hypernyms', () => {
    expect(odenet.synsets.get('odenet-1-n')).toMatchObject({
      description: 'a member of the genus Canis',
      hypernyms: ['odenet-9-n'],
    });
    // a hyponym relation is not a hypernym; a synset without a definition has an empty one
    expect(odenet.synsets.get('odenet-2-n')).toMatchObject({
      description: '',
      hypernyms: ['odenet-1-n'],
    });
    expect(odenet.synsets.get('odenet-9-n')?.hypernyms).toEqual([]);
  });

  it('knows the parts of speech the game uses', () => {
    expect(odenet.entries.map(partOfSpeechOf)).toEqual(['n', 'n', 'n', 'v', 'a']);
    expect(partOfSpeechOf({ word: 'a', partOfSpeech: 'p', basic: false, senses: [] })).toBe(
      'other',
    );
  });
});

describe('noun kinds', () => {
  const definitions = parseNounDefinitions(DATA_NOUN);

  it('takes the definition without the examples and leaves out one that has two kinds', () => {
    expect(definitions.get('a member of the genus Canis')).toBe(5);
    expect(definitions.get('a personal view')).toBe(9);
    // "something shared" is the definition of a thing (6) and of a notion (9): a guess, not used
    expect(definitions.has('something shared')).toBe(false);
  });

  it('gives a sense its kind by definition, and the senses without one the kind of their hypernym', () => {
    const kinds = nounKinds(parseOdeNet(XML), definitions);
    expect(kinds.get('odenet-1-n')).toBe(5);
    expect(kinds.get('odenet-3-n')).toBe(9);
    // no definition, but a hypernym with a kind: a Rüde is a dog
    expect(kinds.get('odenet-2-n')).toBe(5);
    // verbs have no kind
    expect(kinds.has('odenet-4-v')).toBe(false);
  });
});

describe('nounSynonyms', () => {
  const synonyms = nounSynonyms(
    parseOdeNet(`<LexicalResource>
<LexicalEntry id="w1"><Lemma writtenForm="Gehirn" partOfSpeech="n"/><Sense id="w1_1-n" synset="odenet-1-n"/><Sense id="w1_2-n" synset="odenet-2-n"/></LexicalEntry>
<LexicalEntry id="w2"><Lemma writtenForm="Hirn" partOfSpeech="n"/><Sense id="w2_1-n" synset="odenet-1-n"/></LexicalEntry>
<LexicalEntry id="w3"><Lemma writtenForm="graue Zellen" partOfSpeech="n"/><Sense id="w3_1-n" synset="odenet-1-n"/></LexicalEntry>
<LexicalEntry id="w4"><Lemma writtenForm="Denkorgan" partOfSpeech="n"/><Sense id="w4_2-n" synset="odenet-2-n"/></LexicalEntry>
<LexicalEntry id="w5"><Lemma writtenForm="denken" partOfSpeech="v"/><Sense id="w5_1-v" synset="odenet-1-v"/></LexicalEntry>
<LexicalEntry id="w6"><Lemma writtenForm="überlegen" partOfSpeech="v"/><Sense id="w6_1-v" synset="odenet-1-v"/></LexicalEntry>
</LexicalResource>`),
  );

  it('gives the other nouns of every sense of a word, in lower case', () => {
    expect([...(synonyms.get('gehirn') ?? [])].sort()).toEqual(['denkorgan', 'hirn']);
    expect([...(synonyms.get('hirn') ?? [])]).toEqual(['gehirn']);
  });

  it('leaves out words of more than one word, and everything that is not a noun', () => {
    expect(synonyms.get('hirn')?.has('graue zellen')).toBe(false);
    expect(synonyms.has('denken')).toBe(false);
  });
});
