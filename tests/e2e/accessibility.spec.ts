import AxeBuilder from '@axe-core/playwright';

import { expect, pages, test } from './fixtures';

// Automated accessibility scan (axe) of every page against WCAG 2.2 AA plus best practices.
// It finds roughly a third of the possible problems; keyboard and screen reader use still
// deserve a manual check.
for (const path of pages) {
  test(`${path} has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();

    const summary = results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n` +
        violation.nodes.map((node) => `  ${node.target.join(' ')}`).join('\n'),
    );
    expect(summary, 'accessibility violations').toEqual([]);
  });
}
