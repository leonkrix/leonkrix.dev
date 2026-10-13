import { makeWordData, type WordData } from '../logic/data';
import secretsUrl from './secrets.txt?url';
import vectorsUrl from './vectors.bin?url';
import vocabularyUrl from './vocabulary.txt?url';

let loaded: Promise<WordData> | undefined;

async function fetchOk(url: string): Promise<Response> {
  // Low priority: the page (text, fonts) comes first, the words are not needed before the game runs
  const response = await fetch(url, { priority: 'low' });
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${String(response.status)}`);
  }
  return response;
}

/**
 * The words, their numbers and the words that can be hidden (about 2 MB), fetched once. A small
 * script of the game page starts this as soon as the page has loaded, so the files are on their
 * way while the game itself (React and the board) is still loading. The three files get their
 * address from the build (with a fingerprint), so they are cached for good.
 */
export function loadWordData(): Promise<WordData> {
  loaded ??= (async () => {
    const [vocabulary, vectors, secrets] = await Promise.all([
      fetchOk(vocabularyUrl).then((response) => response.text()),
      fetchOk(vectorsUrl).then((response) => response.arrayBuffer()),
      fetchOk(secretsUrl).then((response) => response.text()),
    ]);
    return makeWordData(vocabulary, new Int8Array(vectors), secrets);
  })();
  loaded.catch(() => {
    // A failed load can be tried again
    loaded = undefined;
  });
  return loaded;
}
