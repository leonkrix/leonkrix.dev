/**
 * The layout guard: in every browser test, nothing that is already on the page may move or change
 * its size, not even for a single frame. That is what makes dynamic content calm: a message, a
 * result, a loaded game or a list that fills must have its space reserved beforehand, otherwise the
 * things next to it and below it jump.
 *
 * How it works: from the moment a page has loaded, a script looks at every element of the page on
 * every frame and remembers where it was first seen (its place on the page and its size, from the
 * layout, so effects with `transform` do not count). When an element is found somewhere else, the
 * guard reports it, and the test fails when it ends. New elements are not
 * a problem in themselves, only what they push away. Elements that are not visible
 * (`visibility: hidden`, `display: none`) are not watched.
 *
 * Exceptions, on purpose and few:
 * - `data-layout-fluid` marks a box whose inner parts are meant to rearrange (the tiles of a
 *   board, a list that grows): the box itself must stay put, what is inside is not watched.
 * - What the visitor asks for is not a surprise: the view is measured anew after a resize of the
 *   window, after a `<details>` was opened or closed, and after a change of the address (also
 *   when a page changes it itself, for example a game that opens a level).
 * - A test that changes a page on purpose can switch the guard off with
 *   `test.use({ layoutGuard: false })`, with a comment that says why.
 */

/** The name under which the page tells the test about a problem */
export const REPORT = '__reportLayout';

/** Runs in the page (it is serialized, so it must not use anything from this file). */
export function layoutGuardScript(reportName: string): void {
  type Box = [top: number, left: number, width: number, height: number];
  let baselines = new WeakMap<Element, Box>();
  const reported = new Set<string>();
  // After something that the visitor asked for, the page needs a moment to show the result (a game
  // that opens a level draws it a few frames after it changed the address): the guard only looks
  // again after that
  let quietUntil = 0;
  // Sticky and fixed parts (the header) change their offset while the page scrolls: not a layout change
  // Words inside a line (display: inline) change their size whenever their text changes: that moves
  // nothing by itself, the block that holds them is watched instead
  const inline = new WeakMap<Element, boolean>();
  const isInline = (element: Element): boolean => {
    let known = inline.get(element);
    if (known === undefined) {
      known = getComputedStyle(element).display === 'inline';
      inline.set(element, known);
    }
    return known;
  };
  const floating = new WeakMap<Element, boolean>();
  const isFloating = (element: Element): boolean => {
    let known = floating.get(element);
    if (known === undefined) {
      const parent = element.parentElement;
      known =
        (parent !== null && isFloating(parent)) ||
        ['sticky', 'fixed'].includes(getComputedStyle(element).position);
      floating.set(element, known);
    }
    return known;
  };
  const report = (window as unknown as Record<string, (text: string) => void>)[reportName];

  const place = (element: HTMLElement): Box | null => {
    // Hidden elements and fixed ones (the menu, the toast of the browser) have no offset parent
    if (element.offsetParent === null) {
      return null;
    }
    let top = 0;
    let left = 0;
    for (
      let node: HTMLElement | null = element;
      node !== null;
      node = node.offsetParent as HTMLElement | null
    ) {
      top += node.offsetTop;
      left += node.offsetLeft;
    }
    return [top, left, element.offsetWidth, element.offsetHeight];
  };

  const describe = (element: HTMLElement): string => {
    const classes = [...element.classList].slice(0, 3).join('.');
    const text = element.textContent.trim().replace(/\s+/g, ' ').slice(0, 30);
    return `<${element.tagName.toLowerCase()}${element.id !== '' ? `#${element.id}` : ''}${classes !== '' ? `.${classes}` : ''}> "${text}"`;
  };

  const sample = (): void => {
    for (const element of document.body.querySelectorAll('*')) {
      // Pictures (SVG) have no place of their own in the layout, and scripts and styles are not shown
      if (
        !(element instanceof HTMLElement) ||
        ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)
      ) {
        continue;
      }
      // Buttons and links lift or shift a little when pointed at, and what they hold does not
      // rearrange: only the button itself is watched
      const holder = element.parentElement?.closest('a, button');
      if (holder !== null && holder !== undefined) {
        continue;
      }
      // Inside a fluid box the parts may rearrange, the box itself is watched like any other
      const fluid = element.closest('[data-layout-fluid]');
      if (fluid !== null && fluid !== element) {
        continue;
      }
      if (isFloating(element) || isInline(element)) {
        continue;
      }
      // Nobody sees what is invisible (the confirmation of a form that waits under the form): it
      // may fill with text, and it counts as new when it is shown
      if (!element.checkVisibility({ visibilityProperty: true })) {
        baselines.delete(element);
        continue;
      }
      const now = place(element);
      if (now === null) {
        continue;
      }
      const before = baselines.get(element);
      baselines.set(element, now);
      if (before === undefined || performance.now() < quietUntil) {
        continue;
      }
      // Moved: its top changed, or both its left and its right edge changed. A box that only grows or
      // shrinks (text that changes, a line that wraps) is not a move: what it pushes is moved, and that is
      // reported at the thing that moved.
      const [top, left, width] = now;
      const [oldTop, oldLeft, oldWidth] = before;
      const moved =
        Math.abs(top - oldTop) > 1 ||
        (Math.abs(left - oldLeft) > 1 && Math.abs(left + width - (oldLeft + oldWidth)) > 1);
      if (moved) {
        const message = `${describe(element)}: [top, left, width, height] ${before.join(', ')} to ${now.join(', ')}`;
        if (!reported.has(message)) {
          reported.add(message);
          report?.(message);
        }
      }
    }
    // The page itself: a higher page means that something that was not there was added in the flow
    const height = document.documentElement.scrollHeight;
    const known = (window as unknown as { __pageHeight?: number | undefined }).__pageHeight;
    (window as unknown as { __pageHeight?: number | undefined }).__pageHeight = height;
    if (known !== undefined && Math.abs(known - height) > 1 && performance.now() >= quietUntil) {
      const message = `the page: height ${String(known)} to ${String(height)}`;
      if (!reported.has(message)) {
        reported.add(message);
        report?.(message);
      }
    }
    window.requestAnimationFrame(sample);
  };

  // What the visitor asks for (a new window size, an opened panel) is not a surprise
  const forget = (): void => {
    quietUntil = performance.now() + 600;
    baselines = new WeakMap();
    (window as unknown as { __pageHeight?: number | undefined }).__pageHeight = undefined;
  };
  window.addEventListener('resize', forget);
  document.addEventListener('toggle', forget, true);
  // The toggle event of a <details> comes a moment after the panel has opened (a task of its own), and
  // a frame can be sampled in between on a busy machine: the click on the summary is the first sign
  document.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('summary') !== null) {
        forget();
      }
    },
    true,
  );
  window.addEventListener('popstate', forget);
  // A page that changes its own address (a game that opens a level) shows something new on purpose
  for (const name of ['pushState', 'replaceState'] as const) {
    const original = history[name].bind(history);
    history[name] = (...args: Parameters<History['pushState']>): void => {
      original(...args);
      forget();
    };
  }

  const start = (): void => {
    window.requestAnimationFrame(sample);
  };
  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }
}
