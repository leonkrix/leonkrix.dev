import { gamePaths } from '../../src/games/registry';

/**
 * Pages that exist on the site. The Playground pages are included as soon as a game is live, so
 * every test that loops over the pages covers them. A test in `tests/build-output` compares this
 * list with the pages of the build, so a new page cannot be forgotten.
 */
export const pages: readonly string[] = ['/', '/legal-notice/', '/privacy-policy/', ...gamePaths()];

/** An address that does not exist, which shows the 404 page */
export const notFoundPath = '/this-page-does-not-exist';
