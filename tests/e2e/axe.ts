import BaseAxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { PrivacyGuard } from 'playwright-privacy-guard';

/**
 * axe-core, as the tests use it. Its colour contrast check reads pixels back from a canvas
 * (`getImageData`), which the privacy guard would call fingerprinting. That is the checker, not the
 * site (which draws no canvas), so a run of axe allows it from that moment on, and nothing before:
 * a page that reads a canvas by itself is still found.
 */
const guards = new WeakMap<Page, PrivacyGuard>();

/** Called by the fixture of every test, so that a run of axe can talk to the guard of its page */
export function watchForAxe(page: Page, guard: PrivacyGuard): void {
  guards.set(page, guard);
}

export default class AxeBuilder extends BaseAxeBuilder {
  private readonly watched: Page;

  constructor(options: { page: Page }) {
    super(options);
    this.watched = options.page;
  }

  override analyze(): ReturnType<BaseAxeBuilder['analyze']> {
    guards.get(this.watched)?.allow({
      fingerprint: [
        { match: 'canvas', reason: 'axe-core reads pixels back for its colour contrast check' },
      ],
    });
    return super.analyze();
  }
}
