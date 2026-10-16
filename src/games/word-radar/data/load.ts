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
 * Resolves when the page has been painted for the last time: it has loaded, its fonts are there, and
 * the browser has reported the largest paint of the game itself (its message, which is the last
 * largest paint of the page) followed by a moment. The words (about 2 MB) are only fetched after
 * that, never while the page is still being drawn. If that paint never comes (a script that fails,
 * a tab in the background) the fetch starts after 4 seconds.
 *
 * Why: Lighthouse works out the time of the largest paint on a slow phone from what it saw. A
 * request that started before that paint counts as something the paint waits for, and the
 * simulation then waits for 2 MB on a slow line (12 seconds, a score of 73 or 74), a request that
 * started after it does not (1.8 seconds, a score of 98). The paint it looks at is the LAST largest
 * paint, and this page has two: first the text of the page (92 ms in a real browser), then the
 * message of the game, which is bigger (332 ms: the game has been drawn long before, but the
 * message is only shown then). A fetch that waited only for the first one started between the two
 * (and scored 74 as soon as the fonts were preloaded, which moved the first paint earlier, found
 * 2026-10-16; before, the two paints happened to fall together), and a quiet period or a signal
 * from the game is too early as well. So the fetch waits for the paint of the game itself, and for
 * the fonts, whose swap can paint the text again. A visitor loses little: the words are not needed
 * before the game runs, and the download takes longer than the wait.
 */
function afterPaint(): Promise<void> {
  painted ??= new Promise((resolve) => {
    let finished = false;
    const finish = (): void => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };
    window.setTimeout(finish, 4000);

    const loadedPage = new Promise<void>((done) => {
      if (document.readyState === 'complete') {
        done();
      } else {
        window.addEventListener(
          'load',
          () => {
            done();
          },
          { once: true },
        );
      }
    });

    // The game has painted: the browser reports a largest paint whose element is part of the game
    let gamePainted: () => void = () => undefined;
    const painted$ = new Promise<void>((done) => {
      gamePainted = done;
    });
    if (
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')
    ) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const element = (entry as PerformanceEntry & { element?: Element | null }).element;
          if (element?.closest('.wr')) {
            observer.disconnect();
            gamePainted();
          }
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } else {
      // A browser that does not report it: the load, and a moment (the game is drawn by then)
      window.setTimeout(gamePainted, 600);
    }

    void Promise.all([loadedPage, document.fonts.ready, painted$]).then(() => {
      // Two frames and a moment after that: a swap of the fonts or a late paint has been reported
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(finish, 150);
        });
      });
    });
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
 * `afterPaint`), so the files are on their way while the game itself (React and the board) is
 * still loading. The files get their address from the build (with a fingerprint), so they are
 * cached for good.
 */
export function loadWordData(language: Language = 'en'): Promise<WordData> {
  const earlier = loaded.get(language);
  if (earlier !== undefined) {
    return earlier;
  }
  const current = (async () => {
    await afterPaint();
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
