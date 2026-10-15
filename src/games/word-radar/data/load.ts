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

let painted: Promise<void> | undefined;

/**
 * Resolves when the page has been painted: when the browser reports the first largest paint (a
 * moment later), or, in a browser that does not report it, when the page has loaded and two frames
 * have been drawn. The words (about 2 MB) are only fetched after that, never while the page is
 * still being drawn. A page that is never painted (a tab in the background) starts after 4 seconds.
 *
 * Why: Lighthouse works out the time of the largest paint on a slow phone from what it saw. A
 * request that starts before the paint it saw counts as something the paint waits for, and the
 * simulation then waits for 2 MB on a slow line (12 seconds, a score of 73), a request that starts
 * after it does not (1.8 seconds, a score of 98). The words used to start in the same few
 * milliseconds as the first paint, so the same page scored 98 or 73, whichever came first, and
 * on a slow machine (the build server) the two were even closer together; a fixed wait did not
 * help there either (under load the paint came after 1.2 seconds, the wait was over after 0.5),
 * so the fetch waits for the paint itself. A visitor loses nothing: the words are not needed
 * before the game runs, and the download takes longer than this wait.
 */
function afterFirstPaint(): Promise<void> {
  painted ??= new Promise((resolve) => {
    let started = false;
    const go = (delay: number): void => {
      if (!started) {
        started = true;
        window.setTimeout(resolve, delay);
      }
    };
    window.setTimeout(() => {
      go(0);
    }, 4000);

    const reportsPaint =
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint');
    if (reportsPaint) {
      new PerformanceObserver(() => {
        go(100);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      return;
    }
    const wait = (): void => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          go(150);
        });
      });
    };
    if (document.readyState === 'complete') {
      wait();
    } else {
      window.addEventListener('load', wait, { once: true });
    }
  });
  return painted;
}

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
 * language. A small script of the game page starts this once the page has been painted (see
 * `afterFirstPaint`), so the files are on their way while the game itself (React and the board) is
 * still loading. The files get their address from the build (with a fingerprint), so they are
 * cached for good.
 */
export function loadWordData(language: Language = 'en'): Promise<WordData> {
  const earlier = loaded.get(language);
  if (earlier !== undefined) {
    return earlier;
  }
  const current = (async () => {
    await afterFirstPaint();
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
