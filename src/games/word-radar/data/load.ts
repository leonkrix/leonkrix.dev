import { makeWordData, type WordData } from '../logic/data';
import { type Language } from '../logic/language';
import germanFormsUrl from './de/forms.txt?url';
import germanSecretsUrl from './de/secrets.txt?url';
import germanVectorsUrl from './de/vectors.bin?url';
import germanVocabularyUrl from './de/vocabulary.txt?url';
import secretsUrl from './secrets.txt?url';
import vectorsUrl from './vectors.bin?url';
import vocabularyUrl from './vocabulary.txt?url';

/** The three files of each language. Only the files of the language that is played are fetched. */
const files: Readonly<
  Record<Language, { vocabulary: string; vectors: string; secrets: string; forms?: string }>
> = {
  en: { vocabulary: vocabularyUrl, vectors: vectorsUrl, secrets: secretsUrl },
  // The German game also has a list of forms (Hunde for Hund)
  de: {
    vocabulary: germanVocabularyUrl,
    vectors: germanVectorsUrl,
    secrets: germanSecretsUrl,
    forms: germanFormsUrl,
  },
};

const loaded = new Map<Language, Promise<WordData>>();

async function fetchOk(url: string): Promise<Response> {
  // Low priority: the page (text, fonts) comes first, the words are not needed before the game runs
  const response = await fetch(url, { priority: 'low' });
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${String(response.status)}`);
  }
  return response;
}

/**
 * The words, their numbers and the words that can be hidden (about 2 MB), fetched once for a
 * language. A small script of the game page starts this as soon as the page has loaded, so the files
 * are on their way while the game itself (React and the board) is still loading. The files get their
 * address from the build (with a fingerprint), so they are cached for good.
 */
export function loadWordData(language: Language = 'en'): Promise<WordData> {
  const earlier = loaded.get(language);
  if (earlier !== undefined) {
    return earlier;
  }
  const current = (async () => {
    const urls = files[language];
    const [vocabulary, vectors, secrets, forms] = await Promise.all([
      fetchOk(urls.vocabulary).then((response) => response.text()),
      fetchOk(urls.vectors).then((response) => response.arrayBuffer()),
      fetchOk(urls.secrets).then((response) => response.text()),
      urls.forms === undefined ? '' : fetchOk(urls.forms).then((response) => response.text()),
    ]);
    return makeWordData(vocabulary, new Int8Array(vectors), secrets, language, forms);
  })();
  loaded.set(language, current);
  current.catch(() => {
    // A failed load can be tried again
    loaded.delete(language);
  });
  return current;
}
