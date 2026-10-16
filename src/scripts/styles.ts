/**
 * Loads a stylesheet when it is needed and resolves when it is applied. The palette, the terminal and
 * the radar sweep are fetched only when somebody uses them, and so are their styles: a CSS file that
 * a script imports would be linked by every page (Astro collects the styles of the scripts of a
 * page, also of those it only loads later), so these files are imported as an address (`?url`) and
 * added here. Asking twice for the same file adds it once.
 */
export function loadStyles(...urls: string[]): Promise<void> {
  return Promise.all(urls.map(loadOne)).then(() => undefined);
}

function loadOne(url: string): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`link[data-lazy-style="${url}"]`);
  if (existing) {
    return existing.sheet ? Promise.resolve() : waitFor(existing);
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.lazyStyle = url;
  const loaded = waitFor(link);
  document.head.append(link);
  return loaded;
}

function waitFor(link: HTMLLinkElement): Promise<void> {
  return new Promise((resolve) => {
    // A style that fails to load must not stop the feature; it is then only unstyled
    link.addEventListener('load', () => {
      resolve();
    });
    link.addEventListener('error', () => {
      resolve();
    });
  });
}
