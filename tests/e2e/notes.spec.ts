import { expect, pages, test } from './fixtures';

// A note is one narrow column: the heading, the lines under it and everything in the text (running
// text, figures, steps, key figures, code, tables) are as wide as the text and no wider. This looks
// at every note, on a wide and on a narrow screen, so a figure or a long word that sticks out is
// found at once. (The layout guard looks at things that move, this looks at the width.)
const notes = pages.filter((path) => path.startsWith('/notes/') && path !== '/notes/');
/** 42rem, the width of the text (the same value as in global.css) */
const COLUMN = 42 * 16;

for (const path of notes) {
  test(`${path} keeps the heading and everything in the text in one column`, async ({ page }) => {
    await page.goto(path);
    const wide = await page.evaluate((column) => {
      const text = document.querySelector('.note-prose');
      const header = document.querySelector('main header');
      if (text === null || header === null) {
        return ['the page has no text or no header'];
      }
      const problems: string[] = [];
      const check = (element: Element, left: number, label: string): void => {
        const box = element.getBoundingClientRect();
        // A box may not be wider than the column, may not start left of it or end right of it, and
        // may not reach out of the screen (on a narrow one)
        if (
          box.width > column + 1 ||
          box.left < left - 1 ||
          box.right > left + column + 1 ||
          box.right > window.innerWidth + 1
        ) {
          problems.push(
            `${label}: ${String(Math.round(box.left))} to ${String(Math.round(box.right))}`,
          );
        }
      };
      const textLeft = text.getBoundingClientRect().left;
      const headerLeft = header.getBoundingClientRect().left;
      for (const part of header.children) {
        check(part, headerLeft, `header ${part.tagName.toLowerCase()}`);
      }
      for (const part of text.children) {
        check(
          part,
          textLeft,
          `text ${part.tagName.toLowerCase()} "${part.textContent.slice(0, 24)}"`,
        );
      }
      // The page itself must not scroll sideways either
      if (document.documentElement.scrollWidth > window.innerWidth) {
        problems.push('the page scrolls sideways');
      }
      return problems;
    }, COLUMN);
    expect(wide, 'things wider than the column').toEqual([]);
  });
}

// Tailwind removes the bullets and numbers of every list, and the text of a note puts them back
// (global.css). A rule that is too narrow loses them silently, so the lists of the text and the
// lists in quotes are checked here. (The lists of figures and steps draw their own.)
for (const path of notes) {
  test(`${path} shows the numbers and bullets of its lists`, async ({ page }) => {
    await page.goto(path);
    const lists = await page.evaluate(() =>
      [
        ...document.querySelectorAll('.note-prose > ul, .note-prose > ol'),
        ...document.querySelectorAll('.note-prose blockquote ul, .note-prose blockquote ol'),
      ]
        // A list that a component draws with its own marks (the steps) is not a list of the text
        .filter((list) => !list.classList.contains('note-steps'))
        .map((list) => [list.tagName.toLowerCase(), getComputedStyle(list).listStyleType]),
    );
    for (const [tag, style] of lists) {
      expect(style, `a ${String(tag)} of the text has no marks`).toBe(
        tag === 'ol' ? 'decimal' : 'disc',
      );
    }
  });
}
