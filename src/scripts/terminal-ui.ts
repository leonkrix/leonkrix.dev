import { decodeEmail } from '@/lib/palette';
import type { PaletteData } from '@/lib/palette-data';
import { complete, type Effect, type Line, runCommand } from '@/lib/terminal';

/**
 * The screen of the terminal: prints the lines of a command, keeps the history of the session (in
 * memory only, nothing is stored) and completes with Tab. It is used by the palette and by the 404
 * page; the commands themselves live in `src/lib/terminal.ts`.
 */

const MAX_LINES = 200;

export interface TerminalOptions {
  /** Where the lines go (`role="log"`, so a screen reader hears what is printed) */
  log: HTMLElement;
  input: HTMLInputElement;
  data: PaletteData;
  /** Called for what a command wants to do besides printing (go to a page, close, ...) */
  onEffect: (effect: Effect) => void;
}

export interface Terminal {
  /** Handles Enter, the arrows and Tab in the input; true when the key was used */
  handleKey: (event: KeyboardEvent) => boolean;
  print: (lines: Line[]) => void;
  clear: () => void;
}

/** Copies my address to the clipboard; false when the browser does not allow it. */
export async function copyEmail(data: PaletteData): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(decodeEmail(data.email));
    return true;
  } catch {
    return false;
  }
}

function cellElement(cell: Line[number]): HTMLElement {
  const element = document.createElement(cell.href === undefined ? 'span' : 'a');
  element.textContent = cell.text;
  if (element instanceof HTMLAnchorElement && cell.href !== undefined) {
    element.href = cell.href;
    element.className = 'term-link';
  }
  if (cell.tone !== undefined && cell.tone !== 'plain') {
    element.classList.add(`term-tone-${cell.tone}`);
  }
  return element;
}

function lineElement(line: Line): HTMLElement {
  const element = document.createElement('div');
  element.className = 'term-line';
  element.append(...line.map(cellElement));
  return element;
}

export function createTerminal({ log, input, data, onEffect }: TerminalOptions): Terminal {
  const history: string[] = [];
  let position = 0;

  const print = (lines: Line[]): void => {
    log.append(...lines.map(lineElement));
    while (log.childElementCount > MAX_LINES) {
      log.firstElementChild?.remove();
    }
    log.scrollTop = log.scrollHeight;
  };

  const clear = (): void => {
    log.replaceChildren();
  };

  const submit = (): void => {
    const text = input.value;
    input.value = '';
    if (text.trim() !== '') {
      history.push(text);
    }
    position = history.length;
    print([[{ text: '$ ', tone: 'accent' }, { text }]]);
    const result = runCommand(text, data, { path: window.location.pathname });
    if (result.lines.length > 0) {
      print(result.lines);
    }
    if (result.effect !== undefined) {
      onEffect(result.effect);
    }
  };

  const handleKey = (event: KeyboardEvent): boolean => {
    if (event.isComposing) {
      return false;
    }
    switch (event.key) {
      case 'Enter':
        submit();
        return true;
      case 'ArrowUp':
        if (position > 0) {
          position -= 1;
          input.value = history[position] ?? '';
        }
        return true;
      case 'ArrowDown':
        if (position < history.length) {
          position += 1;
          input.value = history[position] ?? '';
        }
        return true;
      case 'Tab': {
        if (event.shiftKey) {
          return false;
        }
        const completed = complete(input.value, data);
        if (completed !== undefined) {
          input.value = completed;
        }
        return true;
      }
      default:
        return false;
    }
  };

  return { handleKey, print, clear };
}
