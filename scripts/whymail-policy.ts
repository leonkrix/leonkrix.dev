/**
 * The privacy policy of the WhyMail app, published on this site (src/pages/whymail/datenschutz.astro).
 * The text is written in the repository of the app; this site keeps a copy of the published part
 * and a page made from it (see src/lib/whymail-policy.ts for what the conversion does).
 *
 *   pnpm whymail-policy sync <file>    take the text from the file of the app (docs/legal/privacy-policy.md),
 *                                      write the copy and the page; then read `git diff` and commit
 *   pnpm whymail-policy check <file>   say whether the file of the app differs from the copy, without
 *                                      changing anything (the daily workflow runs this)
 *   pnpm whymail-policy build          make the page again from the copy (after the conversion changed)
 *
 * `check` exits with 0 whenever it could compare (it prints `changed=true` or `changed=false`, and
 * writes the same to $GITHUB_OUTPUT), and with 1 when it could not: a missing file, a changed
 * structure. A failed run must never look like "nothing changed". No dependencies: Node 24 runs this
 * TypeScript file directly.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { extractPublished, hashOf, normalize, toMdx } from '../src/lib/whymail-policy.ts';

const folder = join(import.meta.dirname, '..', 'src', 'texts', 'whymail');
export const SNAPSHOT = join(folder, 'privacy-policy.upstream.md');
export const PAGE = join(folder, 'privacy-policy.mdx');

export interface Paths {
  snapshot: string;
  page: string;
}

/** Output for people and for the workflow (stdout) */
function say(text: string): void {
  process.stdout.write(`${text}\n`);
}

const defaults: Paths = { snapshot: SNAPSHOT, page: PAGE };

function recordedText(snapshot: string): string {
  return normalize(readFileSync(snapshot, 'utf8'));
}

/** Takes the published part of the file of the app, writes the copy and the page. Nothing is written if the conversion fails. */
export function sync(
  upstreamFile: string,
  paths: Paths = defaults,
): { before: string; after: string } {
  const published = extractPublished(readFileSync(upstreamFile, 'utf8'));
  const page = toMdx(published);
  const before = existsSync(paths.snapshot) ? hashOf(recordedText(paths.snapshot)) : 'none';
  writeFileSync(paths.snapshot, published);
  writeFileSync(paths.page, page);
  return { before, after: hashOf(published) };
}

/** Writes the page again from the copy */
export function build(paths: Paths = defaults): string {
  const published = recordedText(paths.snapshot);
  writeFileSync(paths.page, toMdx(published));
  return hashOf(published);
}

/** Compares the file of the app with the copy */
export function check(
  upstreamFile: string,
  paths: Paths = defaults,
): { changed: boolean; recorded: string; upstream: string } {
  const recorded = hashOf(recordedText(paths.snapshot));
  const upstream = hashOf(extractPublished(readFileSync(upstreamFile, 'utf8')));
  return { changed: recorded !== upstream, recorded, upstream };
}

export function main(argv: readonly string[]): number {
  const [command, file] = argv;
  try {
    if (command === 'build') {
      say(`The page was made again from the copy (sha256 ${build()}).`);
      return 0;
    }
    if ((command === 'sync' || command === 'check') && file === undefined) {
      console.error(`Usage: pnpm whymail-policy ${command} <path to docs/legal/privacy-policy.md>`);
      return 1;
    }
    if (command === 'sync' && file !== undefined) {
      const { before, after } = sync(file);
      say(
        before === after
          ? `The copy is up to date (sha256 ${after}).`
          : `The copy and the page were updated.\n  before: ${before}\n  after:  ${after}\nRead \`git diff\`, then commit.`,
      );
      return 0;
    }
    if (command === 'check' && file !== undefined) {
      const { changed, recorded, upstream } = check(file);
      say(changed ? 'changed=true' : 'changed=false');
      say(`recorded=${recorded}\nupstream=${upstream}`);
      const output = process.env.GITHUB_OUTPUT;
      if (output) {
        appendFileSync(
          output,
          `changed=${String(changed)}\nrecorded=${recorded}\nupstream=${upstream}\n`,
        );
      }
      return 0;
    }
    console.error('Usage: pnpm whymail-policy sync|check <file>, or pnpm whymail-policy build');
    return 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
