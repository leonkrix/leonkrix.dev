import {
  angleOf,
  type Box,
  isOnScreen,
  pingDelay,
  summary,
  SWEEP_MS,
  uniqueByLabel,
} from '@/lib/radar';
import radarStyles from '@/styles/radar.css?url';

import { loadStyles } from './styles';

/**
 * The radar (Konami code, the command `radar`): a beam turns around the middle of the screen, the
 * things of the page that carry `data-radar="Label"` light up when the beam reaches them, and a
 * panel lists everything the page has to show, as buttons that scroll to it. With reduced motion
 * there is only the panel. Everything is a fixed layer that ignores the pointer, so nothing on the
 * page moves, and nothing is stored.
 */

interface Find {
  label: string;
  element: HTMLElement;
}

const PING_MS = 2800;

let close: (() => void) | undefined;
/** Removes the frame of the find that was chosen in the list last */
let removeChosen: (() => void) | undefined;

function findings(): Find[] {
  const found: Find[] = [];
  for (const element of document.querySelectorAll<HTMLElement>('[data-radar]')) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden') {
      found.push({ label: element.dataset.radar ?? '', element });
    }
  }
  return uniqueByLabel(found);
}

function box(element: HTMLElement): Box {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}

/** Puts a frame where its element is now, and its label above (or inside, when there is no room above) */
function place(frame: HTMLElement, label: HTMLElement, element: HTMLElement): void {
  const area = box(element);
  frame.style.left = `${String(area.x)}px`;
  frame.style.top = `${String(area.y)}px`;
  frame.style.width = `${String(area.width)}px`;
  frame.style.height = `${String(area.height)}px`;
  const inside = area.y < 34;
  label.classList.toggle('inside', inside);
  label.style.top = inside ? `${String(Math.max(6, 6 - area.y))}px` : '';
}

/**
 * A frame around a find, with its label, that appears after `delay` and fades away again. It is
 * put at the place of the element in every frame of the screen for as long as it exists: the page
 * may be scrolling (smoothly, to the thing that was chosen) or the thing may still be moving into
 * its place (the blocks that fade in when they are scrolled to), and a frame that was measured once
 * would be where the thing was a moment ago.
 */
function pingElement(find: Find, delay: number): HTMLElement {
  const frame = document.createElement('div');
  frame.className = 'radar-ping';
  frame.style.animationDelay = `${String(delay)}ms`;
  const label = document.createElement('span');
  label.className = 'radar-ping-label';
  label.textContent = find.label;
  frame.append(label);
  const follow = (): void => {
    if (frame.isConnected) {
      place(frame, label, find.element);
      window.requestAnimationFrame(follow);
    }
  };
  place(frame, label, find.element);
  window.requestAnimationFrame(follow);
  return frame;
}

/** Frames around finds, in a fixed layer that removes itself when the last one has faded */
function ping(finds: { find: Find; delay: number }[]): () => void {
  const layer = document.createElement('div');
  layer.className = 'radar-pings';
  layer.setAttribute('aria-hidden', 'true');
  layer.append(...finds.map(({ find, delay }) => pingElement(find, delay)));
  document.body.append(layer);
  const remove = (): void => {
    layer.remove();
  };
  window.setTimeout(remove, Math.max(0, ...finds.map(({ delay }) => delay)) + PING_MS + 200);
  return remove;
}

/**
 * Resolves when an element has stopped moving: its box was the same in six frames in a row (or
 * after three seconds). After a click in the list the page scrolls smoothly and a block that
 * fades in rises into its place, so the frame must not start before that is over.
 */
function settled(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    let last = '';
    let calm = 0;
    const check = (): void => {
      const { x, y, width, height } = element.getBoundingClientRect();
      const now = [x, y, width, height].map((value) => value.toFixed(1)).join('|');
      calm = now === last ? calm + 1 : 0;
      last = now;
      if (calm >= 6 || performance.now() - started > 3000) {
        resolve();
      } else {
        window.requestAnimationFrame(check);
      }
    };
    window.requestAnimationFrame(check);
  });
}

function stillMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showPanel(finds: Find[]): () => void {
  const panel = document.createElement('section');
  panel.className = 'radar-panel';
  panel.tabIndex = -1;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'radar-title');

  const title = document.createElement('p');
  title.className = 'radar-title';
  title.id = 'radar-title';
  title.textContent = summary(finds.length);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'radar-close';
  closeButton.textContent = 'Esc';
  // The visible text (Esc) is part of the name (WCAG 2.5.3, Label in Name; axe 4.14 ignores what is in brackets)
  closeButton.setAttribute('aria-label', 'Close the radar, Esc');

  const list = document.createElement('ul');
  list.className = 'radar-list';
  for (const find of finds) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = find.label;
    button.addEventListener('click', () => {
      removeChosen?.();
      removeChosen = undefined;
      find.element.scrollIntoView({ block: 'center', behavior: stillMotion() ? 'auto' : 'smooth' });
      // When the page has got there and the thing has settled, it lights up again
      void settled(find.element).then(() => {
        if (document.body.contains(find.element)) {
          removeChosen?.();
          removeChosen = ping([{ find, delay: 0 }]);
        }
      });
    });
    item.append(button);
    list.append(item);
  }

  panel.append(title, closeButton, list);
  document.body.append(panel);
  panel.focus({ preventScroll: true });

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      close?.();
    }
  };
  document.addEventListener('keydown', onKey);
  closeButton.addEventListener('click', () => close?.());

  return () => {
    document.removeEventListener('keydown', onKey);
    removeChosen?.();
    removeChosen = undefined;
    panel.remove();
  };
}

function show(): void {
  const finds = findings();
  const still = stillMotion();
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const layer = document.createElement('div');
  layer.className = 'radar';
  layer.setAttribute('aria-hidden', 'true');
  const running: { timer?: number; removePanel?: () => void } = {};

  const stop = (): void => {
    window.clearTimeout(running.timer);
    layer.remove();
    running.removePanel?.();
    close = undefined;
  };
  close = stop;

  if (still) {
    running.removePanel = showPanel(finds);
    return;
  }

  for (const name of ['radar-ring', 'radar-beam']) {
    const part = document.createElement('span');
    part.className = name;
    layer.append(part);
  }
  document.body.append(layer);
  ping(
    finds
      .filter((find) => isOnScreen(box(find.element), viewport))
      .map((find) => ({ find, delay: pingDelay(angleOf(box(find.element), viewport)) })),
  );
  // The beam is gone after one turn; then the panel says what was found
  running.timer = window.setTimeout(() => {
    layer.remove();
    running.removePanel = showPanel(finds);
  }, SWEEP_MS + 150);
}

/** Starts the radar; one that is still showing is replaced. */
export function runRadar(): void {
  close?.();
  void loadStyles(radarStyles).then(show);
}
