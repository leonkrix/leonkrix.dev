import {
  buildItems,
  groupResults,
  type PaletteAction,
  type PaletteItem,
  randomGame,
  search,
} from '@/lib/palette';
import type { PaletteData } from '@/lib/palette-data';
import type { Effect } from '@/lib/terminal';
import paletteStyles from '@/styles/palette.css?url';
import terminalStyles from '@/styles/terminal.css?url';

import { loadPaletteData } from './palette-data-client';
import { loadStyles } from './styles';
import { runSweep } from './sweep';
import { copyEmail, createTerminal, type Terminal } from './terminal-ui';

/**
 * The command palette: a native modal dialog with a search field. It lists the places, games,
 * notes, projects and actions of the site; typing ">" turns the field into a terminal. The first
 * call builds the dialog, later calls only open it again. Everything is built with the DOM API from
 * the data of `/palette.json`, nothing is stored, and the box has a fixed size.
 */

type Mode = 'search' | 'terminal';

const HINT_KEYS = 'palette-keys';
const NOTE_MS = 2600;

interface Palette {
  open: (mode: Mode) => void;
}

let palette: Palette | undefined;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    created.setAttribute(name, value);
  }
  return created;
}

function searchIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '11');
  circle.setAttribute('cy', '11');
  circle.setAttribute('r', '7');
  const handle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  handle.setAttribute('d', 'm20 20-3.5-3.5');
  svg.append(circle, handle);
  return svg;
}

function build(data: PaletteData): Palette {
  const items = buildItems(data);

  const dialog = element('dialog', 'palette', {
    'aria-label': 'Search and commands',
    'data-mode': 'search',
  });
  const head = element('div', 'palette-head');
  const mark = element('span', 'palette-mark', { 'aria-hidden': 'true' });
  mark.append(searchIcon());
  const input = element('input', 'palette-input', {
    type: 'text',
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-controls': 'palette-list',
    'aria-autocomplete': 'list',
    'aria-label': 'Search the site or type > for the terminal',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
    placeholder: 'Search, or type > for the terminal',
  });
  const closeButton = element('button', 'palette-close', { type: 'button' });
  closeButton.textContent = 'Esc';
  closeButton.setAttribute('aria-label', 'Close');
  head.append(mark, input, closeButton);

  const body = element('div', 'palette-body');
  const list = element('div', 'palette-list', {
    id: 'palette-list',
    role: 'listbox',
    'aria-label': 'Results',
  });
  const log = element('div', 'palette-log term-log', {
    role: 'log',
    'aria-label': 'Terminal',
    tabindex: '0',
  });
  const empty = element('div', 'palette-empty');
  empty.hidden = true;
  const count = element('p', 'sr-only', { role: 'status' });
  body.append(list, empty, log, count);

  const foot = element('div', 'palette-foot');
  const keys = element('span', HINT_KEYS);
  for (const [key, text] of [
    ['↑↓', ' choose  '],
    ['↵', ' open  '],
    ['>', ' terminal'],
  ] as const) {
    const kbd = element('kbd', '');
    kbd.textContent = key;
    keys.append(kbd, document.createTextNode(text));
  }
  const note = element('span', 'palette-note', { role: 'status' });
  foot.append(keys, note);

  dialog.append(head, body, foot);
  document.body.append(dialog);

  let mode: Mode = 'search';
  let visible: PaletteItem[] = [];
  let active = 0;
  let noteTimer: number | undefined;

  const showNote = (message: string): void => {
    note.textContent = message;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => {
      note.textContent = '';
    }, NOTE_MS);
  };

  const close = (): void => {
    if (dialog.open) {
      dialog.close();
    }
  };

  const go = (href: string): void => {
    close();
    window.location.assign(href);
  };

  const copy = (): Promise<boolean> => copyEmail(data);

  const act = (action: PaletteAction): void => {
    switch (action.kind) {
      case 'go':
        go(action.href);
        break;
      case 'external':
        close();
        window.open(action.href, '_blank', 'noopener,noreferrer');
        break;
      case 'random-game': {
        const href = randomGame(data);
        if (href !== undefined) {
          go(href);
        }
        break;
      }
      case 'copy-email':
        void copy().then((copied) => {
          showNote(copied ? 'Email address copied' : 'Could not copy, please use the contact form');
        });
        break;
      case 'terminal':
        setMode('terminal');
        break;
    }
  };

  const terminal: Terminal = createTerminal({
    log,
    input,
    data,
    onEffect: (effect: Effect) => {
      switch (effect.kind) {
        case 'navigate':
          go(effect.href);
          break;
        case 'external':
          close();
          window.open(effect.href, '_blank', 'noopener,noreferrer');
          break;
        case 'clear':
          terminal.clear();
          break;
        case 'close':
          close();
          break;
        case 'sweep':
          close();
          runSweep();
          break;
        case 'copy-email':
          void copy().then((copied) => {
            if (!copied) {
              terminal.print([
                [{ text: 'Could not copy. Use the contact form instead.', tone: 'error' }],
              ]);
            }
          });
          break;
      }
    },
  });

  const optionId = (index: number): string => `palette-option-${String(index)}`;

  const setActive = (index: number, scroll: boolean): void => {
    if (visible.length === 0) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    active = (index + visible.length) % visible.length;
    for (const option of list.querySelectorAll<HTMLElement>('[role="option"]')) {
      const selected = option.id === optionId(active);
      option.setAttribute('aria-selected', String(selected));
      if (selected) {
        input.setAttribute('aria-activedescendant', option.id);
        if (scroll) {
          option.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  };

  const render = (): void => {
    const results = search(items, input.value);
    const groups = groupResults(results);
    visible = groups.flatMap((group) => group.items);
    active = 0;
    list.replaceChildren();
    const none = visible.length === 0;
    list.hidden = none;
    empty.hidden = !none;
    input.setAttribute('aria-expanded', String(!none));
    count.textContent = none
      ? 'No results'
      : `${String(visible.length)} ${visible.length === 1 ? 'result' : 'results'}`;
    if (none) {
      empty.textContent = `Nothing found for "${input.value.trim()}"`;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let index = 0;
    for (const { group, items: members } of groups) {
      const section = element('div', '', { role: 'group', 'aria-label': group });
      const label = element('div', 'palette-group-label', { 'aria-hidden': 'true' });
      label.textContent = group;
      section.append(label);
      for (const item of members) {
        const position = index;
        const option = element('div', 'palette-option', {
          id: optionId(position),
          role: 'option',
          'aria-selected': 'false',
        });
        const text = element('span', 'palette-label');
        text.textContent = item.label;
        const hint = element('span', 'palette-hint', { 'aria-hidden': 'true' });
        hint.textContent = item.hint;
        option.append(text, hint);
        option.addEventListener('mousemove', () => {
          if (active !== position) {
            setActive(position, false);
          }
        });
        option.addEventListener('click', () => {
          act(item.action);
        });
        section.append(option);
        index += 1;
      }
      list.append(section);
    }
    setActive(0, false);
    list.scrollTop = 0;
  };

  function setMode(next: Mode): void {
    mode = next;
    dialog.dataset.mode = next;
    input.value = '';
    list.hidden = next === 'terminal';
    empty.hidden = true;
    count.textContent = '';
    if (next === 'terminal') {
      mark.replaceChildren('$');
      input.removeAttribute('role');
      input.removeAttribute('aria-controls');
      input.removeAttribute('aria-expanded');
      input.removeAttribute('aria-autocomplete');
      input.removeAttribute('aria-activedescendant');
      input.setAttribute('aria-label', 'Terminal command');
      input.placeholder = 'Type help';
      if (log.childElementCount === 0) {
        terminal.print([
          [{ text: 'leon@leonkrix.dev', tone: 'accent' }],
          [
            {
              text: 'Type "help" for the list of commands, Backspace to go back to the search.',
              tone: 'muted',
            },
          ],
        ]);
      }
    } else {
      mark.replaceChildren(searchIcon());
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-controls', 'palette-list');
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-label', 'Search the site or type > for the terminal');
      input.placeholder = 'Search, or type > for the terminal';
      render();
    }
    input.focus();
  }

  input.addEventListener('input', () => {
    if (mode === 'search') {
      if (input.value.startsWith('>')) {
        setMode('terminal');
        return;
      }
      render();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (mode === 'terminal') {
      if (event.key === 'Backspace' && input.value === '') {
        event.preventDefault();
        setMode('search');
        return;
      }
      if (terminal.handleKey(event)) {
        event.preventDefault();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive(active + 1, true);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive(active - 1, true);
        break;
      case 'Enter': {
        if (event.isComposing) {
          return;
        }
        event.preventDefault();
        const chosen = visible[active];
        if (chosen) {
          act(chosen.action);
        }
        break;
      }
    }
  });

  closeButton.addEventListener('click', close);
  // A click on the dark area around the box closes it
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      close();
    }
  });

  return {
    open: (next: Mode) => {
      if (!dialog.open) {
        dialog.showModal();
      }
      setMode(next);
    },
  };
}

/** Opens the palette (in search mode, or as a terminal), building it on the first call. */
export async function openPalette(mode: Mode = 'search'): Promise<void> {
  if (palette === undefined) {
    // The data and the styles come at the same time; the box is shown when both are there
    const [data] = await Promise.all([
      loadPaletteData(),
      loadStyles(paletteStyles, terminalStyles),
    ]);
    palette = build(data);
  }
  palette.open(mode);
}
