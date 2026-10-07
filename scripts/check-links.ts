/**
 * Link check: finds every external link on the published pages and checks that it still works.
 * Links rot (a repository is renamed, a profile moves), and a dead link on a portfolio looks
 * careless. It runs once a week (.github/workflows/link-check.yml), and by hand:
 *
 *   pnpm check-links                 # the pages of https://leonkrix.dev
 *   pnpm check-links --dir dist      # the pages of a local build
 *
 * The links are read from the pages themselves, so a new link in the content (a project, the
 * footer, a new page) is checked automatically. Only a link that is on none of these pages needs
 * an entry in EXTRA_LINKS. No dependencies: Node 24 runs this TypeScript file directly.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { siteConfig } from '../src/lib/site.ts';
import { isChallenge } from './live-check.ts';

/**
 * Cloudflare's bot protection challenges requests from data centers (GitHub's runners). Then the
 * pages are read from the .pages.dev address of the same deployment, which has no bot protection.
 */
const PAGES_DEV = 'https://leonkrix-dev.pages.dev';

/** Pages whose links are checked. Add new pages with links here (for example /uses). */
export const PAGES: readonly string[] = ['/', '/legal-notice/', '/privacy-policy/'];

/** External links that are on none of the pages above but must keep working. */
export const EXTRA_LINKS: readonly string[] = [];

/** Sites that refuse automated requests. A refusal there is a warning, not a dead link. */
const BOT_WALLS: readonly string[] = ['linkedin.com'];

const USER_AGENT = `${siteConfig.name} link check (+${siteConfig.url})`;

export type LinkStatus = 'pass' | 'warn' | 'fail';

export interface LinkResult {
  url: string;
  status: LinkStatus;
  detail: string;
}

/** Absolute http(s) links in the HTML that lead away from the own site, without duplicates. */
export function extractExternalLinks(html: string, ownHost: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\s[^>]*?href="(https?:\/\/[^"#]+)/g)) {
    const url = match[1];
    if (url === undefined) {
      continue;
    }
    try {
      const { hostname } = new URL(url);
      if (hostname !== ownHost && hostname !== `www.${ownHost}`) {
        links.add(url.replace(/&amp;/g, '&'));
      }
    } catch {
      // not a valid URL: nothing to check
    }
  }
  return [...links].sort();
}

/** The domain itself or one of its subdomains, nothing that only ends with the same letters. */
const isBotWall = (url: string): boolean => {
  const { hostname } = new URL(url);
  return BOT_WALLS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
};

async function request(
  url: string,
  method: 'HEAD' | 'GET',
  fetchImpl: typeof fetch,
): Promise<number> {
  const response = await fetchImpl(url, {
    method,
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
    signal: AbortSignal.timeout(15_000),
  });
  await response.body?.cancel();
  return response.status;
}

export async function checkLink(
  url: string,
  fetchImpl: typeof fetch = fetch,
  retries = 2,
  retryDelay = 3000,
): Promise<LinkResult> {
  let detail = '';
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      let status = await request(url, 'HEAD', fetchImpl);
      // Some servers do not answer HEAD requests
      if ([400, 403, 405, 501].includes(status)) {
        status = await request(url, 'GET', fetchImpl);
      }
      if (status < 400) {
        return { url, status: 'pass', detail: `HTTP ${String(status)}` };
      }
      if (isBotWall(url) && [401, 403, 429, 999].includes(status)) {
        return {
          url,
          status: 'warn',
          detail: `HTTP ${String(status)}: the site refuses automated requests`,
        };
      }
      if (status === 429) {
        return { url, status: 'warn', detail: 'HTTP 429: rate limited, try again later' };
      }
      detail = `HTTP ${String(status)}`;
      // A missing page will not come back by waiting
      if (status === 404 || status === 410) {
        break;
      }
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    if (attempt < retries) {
      await new Promise((done) => setTimeout(done, retryDelay));
    }
  }
  return { url, status: 'fail', detail };
}

export async function checkLinks(
  urls: readonly string[],
  fetchImpl: typeof fetch = fetch,
  retryDelay = 3000,
): Promise<LinkResult[]> {
  const results: LinkResult[] = [];
  for (const url of urls) {
    results.push(await checkLink(url, fetchImpl, 2, retryDelay));
  }
  return results;
}

export function summarize(results: readonly LinkResult[]): {
  text: string;
  markdown: string;
  failed: boolean;
} {
  const icon = { pass: 'OK  ', warn: 'WARN', fail: 'FAIL' } as const;
  const mark = { pass: ':white_check_mark:', warn: ':warning:', fail: ':x:' } as const;
  return {
    text: results.map((r) => `${icon[r.status]}  ${r.url}  ${r.detail}`).join('\n'),
    markdown: [
      '| Link | Result |',
      '| --- | --- |',
      ...results.map((r) => `| ${r.url} | ${mark[r.status]} ${r.detail} |`),
    ].join('\n'),
    failed: results.some((r) => r.status === 'fail'),
  };
}

/** The HTML of a published page, from the custom domain or, when that is challenged, from .pages.dev. */
export async function fetchPage(path: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  for (const base of [siteConfig.url, PAGES_DEV]) {
    const response = await fetchImpl(new URL(path, base), { signal: AbortSignal.timeout(20_000) });
    const body = await response.text();
    if (isChallenge({ status: response.status, headers: response.headers, body })) {
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `${path} answered HTTP ${String(response.status)} at ${new URL(base).hostname}`,
      );
    }
    return body;
  }
  throw new Error(`${path} could not be read: the bot protection challenged both addresses`);
}

async function readPage(path: string, directory: string | undefined): Promise<string> {
  if (directory !== undefined) {
    const file = join(directory, path === '/' ? '' : path, 'index.html');
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
  }
  return fetchPage(path);
}

async function main(): Promise<void> {
  const directoryIndex = process.argv.indexOf('--dir');
  const directory = directoryIndex >= 0 ? process.argv[directoryIndex + 1] : undefined;

  const found = new Set<string>(EXTRA_LINKS);
  for (const path of PAGES) {
    const html = await readPage(path, directory);
    for (const link of extractExternalLinks(html, new URL(siteConfig.url).hostname)) {
      found.add(link);
    }
  }
  const urls = [...found].sort();
  if (urls.length === 0) {
    throw new Error('no external links found: the pages could not be read');
  }

  const results = await checkLinks(urls);
  const { text, markdown, failed } = summarize(results);
  process.stdout.write(`Checked ${String(urls.length)} external links\n\n${text}\n`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    appendFileSync(summary, `## Link check\n\n${markdown}\n`);
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
