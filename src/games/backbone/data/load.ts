import type { LevelRecord } from './pool';

let loaded: Promise<readonly LevelRecord[]> | undefined;

/**
 * The page is drawn first; the level pool (a few hundred kilobytes of JSON) is fetched afterwards,
 * so that it never competes with the first paint (see CLAUDE.md, "Fonts and layout shift", and the
 * note "One page, four scores"). The wait ends when the page has loaded and its fonts are there,
 * plus a moment, or after four seconds at the latest.
 */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      setTimeout(resolve, 150);
    };
    const give = setTimeout(resolve, 4000);
    const ready = (): void => {
      clearTimeout(give);
      void document.fonts.ready.then(done, done);
    };
    if (document.readyState === 'complete') {
      ready();
    } else {
      window.addEventListener('load', ready, { once: true });
    }
  });
}

export function loadPool(): Promise<readonly LevelRecord[]> {
  loaded ??= afterPaint().then(async () => {
    const module = await import('./levels.json');
    return module.default as unknown as readonly LevelRecord[];
  });
  return loaded;
}
