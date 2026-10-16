import sweepStyles from '@/styles/sweep.css?url';

import { loadStyles } from './styles';

const DURATION = 2200;
const MESSAGE = 'Radar online. Nothing hidden here: everything is on the page.';

let running = false;

/**
 * A short radar sweep over the page, the easter egg of the Konami code and the command `radar`. With
 * reduced motion there is only the message. Nothing is stored and nothing moves: the sweep is a
 * fixed layer that ignores the pointer.
 */
export function runSweep(): void {
  if (running) {
    return;
  }
  running = true;
  void loadStyles(sweepStyles).then(show);
}

function show(): void {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const note = document.createElement('p');
  note.className = 'sweep-note';
  note.setAttribute('role', 'status');
  note.textContent = MESSAGE;

  const layer = document.createElement('div');
  layer.className = 'sweep';
  layer.setAttribute('aria-hidden', 'true');
  for (const name of ['sweep-ring', 'sweep-beam']) {
    const part = document.createElement('span');
    part.className = name;
    layer.append(part);
  }

  document.body.append(note);
  if (!still) {
    document.body.append(layer);
  }
  window.setTimeout(
    () => {
      layer.remove();
      note.remove();
      running = false;
    },
    still ? 3200 : DURATION + 1000,
  );
}
