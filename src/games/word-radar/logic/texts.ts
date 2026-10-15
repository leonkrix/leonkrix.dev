import { type Language } from './language';
import { type Bucket } from './radar';

/**
 * Every text of the game in both languages. The game is one component for both: it takes the
 * texts of the language of the round, so a new text has to be written twice (the type below makes
 * the compiler ask for it).
 */
export interface Texts {
  /** The name of the language as shown on the switch, written in that language */
  name: string;
  loading: string;
  loadFailed: string;
  placeholder: string;
  placeholderOver: string;
  guessLabel: string;
  guessButton: string;
  intro: string;
  radarSection: string;
  guessesSection: string;
  pictureGroup: string;
  listGroup: string;
  radar: string;
  map: string;
  mapLocked: string;
  yourGuesses: (count: number) => string;
  nearestWords: string;
  nearestLocked: string;
  guessesList: string;
  nearestList: string;
  tagHint: string;
  tagLatest: string;
  tagSynonym: string;
  tagYou: string;
  hint: (count: number) => string;
  giveUp: string;
  reallyGiveUp: string;
  newRound: string;
  copyLink: string;
  linkCopied: string;
  copyFailed: string;
  bucket: Readonly<Record<Bucket['id'], string>>;
  /** "word: rank 12, hot" */
  described: (word: string, rank: string, bucket: string) => string;
  hintPrefix: string;
  found: (word: string, guesses: number) => string;
  duplicate: (word: string, rank: string) => string;
  unknown: (word: string) => string;
  invalid: string;
  noHint: string;
  wordWas: (word: string) => string;
  /** "Hunde counts as " in front of "Hund: rank 5, warm" when a form was typed */
  viaForm: (form: string) => string;
  /** A form of the hidden word was typed: it counts as the word */
  foundByForm: (form: string, word: string, guesses: number) => string;
  /** The hidden word was found by a word that means the same */
  foundSynonym: (typed: string, word: string, guesses: number) => string;
  foundTitle: string;
  wasTitle: string;
  summary: (guesses: number, hints: number) => string;
  gaveUpSummary: string;
}

const english: Texts = {
  name: 'English',
  loading: 'Loading the words (about 2 MB)...',
  loadFailed: 'The words could not be loaded. Please reload the page.',
  placeholder: 'Type a word and press Enter',
  placeholderOver: 'The round is over',
  guessLabel: 'Your guess',
  guessButton: 'Guess',
  intro:
    'Find the hidden word. The closer a guess is in meaning, the lower its rank: rank 1 is the word itself.',
  radarSection: 'Radar',
  guessesSection: 'Guesses',
  pictureGroup: 'Picture',
  listGroup: 'List',
  radar: 'Radar',
  map: 'Map',
  mapLocked: 'The map is shown when the round is over',
  yourGuesses: (count) => `Your guesses (${String(count)})`,
  nearestWords: 'Nearest words',
  nearestLocked: 'The nearest words are shown when the round is over',
  guessesList: 'Guesses made so far, closest first',
  nearestList: 'The words nearest to the hidden word',
  tagHint: 'hint',
  tagLatest: 'latest',
  tagSynonym: 'same word',
  tagYou: 'you',
  hint: (count) => `Hint${count > 0 ? ` (${String(count)})` : ''}`,
  giveUp: 'Give up',
  reallyGiveUp: 'Really give up?',
  newRound: 'New round',
  copyLink: 'Copy link to this round',
  linkCopied: 'Link to this round copied.',
  copyFailed: 'Copying was not possible.',
  bucket: {
    found: 'Found it',
    burning: 'Burning',
    hot: 'Hot',
    warm: 'Warm',
    cool: 'Cool',
    cold: 'Cold',
  },
  described: (word, rank, bucket) => `${word}: rank ${rank}, ${bucket}`,
  hintPrefix: 'Hint: ',
  found: (word, guesses) =>
    `Found it! The word is ${word}, after ${String(guesses)} ${guesses === 1 ? 'guess' : 'guesses'}.`,
  duplicate: (word, rank) => `You tried ${word} already: rank ${rank}.`,
  unknown: (word) =>
    `${word} is not in the word list. Try another word, or a simpler form such as the singular.`,
  invalid: 'Type one word, with letters only.',
  noHint: 'There is no closer hint left. Keep guessing!',
  wordWas: (word) => `The word was ${word}.`,
  viaForm: (form) => `${form} counts as `,
  foundByForm: (form, word, guesses) =>
    `${form} counts as ${word}. Found it! After ${String(guesses)} ${guesses === 1 ? 'guess' : 'guesses'}.`,
  foundSynonym: (typed, word, guesses) =>
    `${typed} means the same: found it! The word is ${word}, after ${String(guesses)} ${guesses === 1 ? 'guess' : 'guesses'}.`,
  foundTitle: 'Found it!',
  wasTitle: 'The word was',
  summary: (guesses, hints) =>
    `${String(guesses)} ${guesses === 1 ? 'guess' : 'guesses'}${hints > 0 ? `, ${String(hints)} ${hints === 1 ? 'hint' : 'hints'}` : ''}.`,
  gaveUpSummary: 'The map shows your guesses, the list the nearest words.',
};

const german: Texts = {
  name: 'Deutsch',
  loading: 'Die Wörter werden geladen (etwa 2,5 MB) ...',
  loadFailed: 'Die Wörter konnten nicht geladen werden. Bitte lade die Seite neu.',
  placeholder: 'Wort eingeben und Enter drücken',
  placeholderOver: 'Die Runde ist vorbei',
  guessLabel: 'Dein Tipp',
  guessButton: 'Raten',
  intro:
    'Finde das versteckte Wort. Je näher ein Tipp in der Bedeutung liegt, desto niedriger sein Rang: Rang 1 ist das Wort selbst.',
  radarSection: 'Radar',
  guessesSection: 'Tipps',
  pictureGroup: 'Bild',
  listGroup: 'Liste',
  radar: 'Radar',
  map: 'Karte',
  mapLocked: 'Die Karte erscheint, wenn die Runde vorbei ist',
  yourGuesses: (count) => `Deine Tipps (${String(count)})`,
  nearestWords: 'Nächste Wörter',
  nearestLocked: 'Die nächsten Wörter erscheinen, wenn die Runde vorbei ist',
  guessesList: 'Bisherige Tipps, die nächsten zuerst',
  nearestList: 'Die Wörter, die dem versteckten Wort am nächsten sind',
  tagHint: 'Hinweis',
  tagLatest: 'neu',
  tagSynonym: 'dasselbe Wort',
  tagYou: 'du',
  hint: (count) => `Hinweis${count > 0 ? ` (${String(count)})` : ''}`,
  giveUp: 'Aufgeben',
  reallyGiveUp: 'Wirklich aufgeben?',
  newRound: 'Neue Runde',
  copyLink: 'Link zur Runde kopieren',
  linkCopied: 'Link zu dieser Runde kopiert.',
  copyFailed: 'Kopieren war nicht möglich.',
  bucket: {
    found: 'Gefunden',
    burning: 'Brennend',
    hot: 'Heiß',
    warm: 'Warm',
    cool: 'Kühl',
    cold: 'Kalt',
  },
  described: (word, rank, bucket) => `${word}: Rang ${rank}, ${bucket}`,
  hintPrefix: 'Hinweis: ',
  found: (word, guesses) =>
    `Gefunden! Das Wort ist ${word}, nach ${String(guesses)} ${guesses === 1 ? 'Tipp' : 'Tipps'}.`,
  duplicate: (word, rank) => `${word} hast du schon versucht: Rang ${rank}.`,
  unknown: (word) =>
    `${word} steht nicht in der Wortliste. Versuche ein anderes Wort oder die Grundform, zum Beispiel den Singular.`,
  invalid: 'Gib ein Wort ein, nur mit Buchstaben.',
  noHint: 'Es gibt keinen näheren Hinweis mehr. Rate weiter!',
  wordWas: (word) => `Das Wort war ${word}.`,
  viaForm: (form) => `${form} zählt als `,
  foundByForm: (form, word, guesses) =>
    `${form} zählt als ${word}. Gefunden! Nach ${String(guesses)} ${guesses === 1 ? 'Tipp' : 'Tipps'}.`,
  foundSynonym: (typed, word, guesses) =>
    `${typed} bedeutet dasselbe: Gefunden! Das Wort ist ${word}, nach ${String(guesses)} ${guesses === 1 ? 'Tipp' : 'Tipps'}.`,
  foundTitle: 'Gefunden!',
  wasTitle: 'Das Wort war',
  summary: (guesses, hints) =>
    `${String(guesses)} ${guesses === 1 ? 'Tipp' : 'Tipps'}${hints > 0 ? `, ${String(hints)} ${hints === 1 ? 'Hinweis' : 'Hinweise'}` : ''}.`,
  gaveUpSummary: 'Die Karte zeigt deine Tipps, die Liste die nächsten Wörter.',
};

export const texts: Readonly<Record<Language, Texts>> = { en: english, de: german };
