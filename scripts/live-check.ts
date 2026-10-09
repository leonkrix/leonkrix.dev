/**
 * Live check: looks at the published site from the outside, the way a visitor (or an attacker, or
 * a search engine) does, and fails when something is wrong. CI checks the code before it is
 * deployed; this checks what is actually running. It runs every few hours and after every
 * production deployment (.github/workflows/live-check.yml), and by hand:
 *
 *   pnpm live-check                       # against https://leonkrix.dev
 *   pnpm live-check --base http://localhost:8788   # against a local `pnpm dev:functions`
 *
 * Cloudflare's bot protection challenges requests from data centers, which includes GitHub's
 * runners. Then the custom domain is only checked for being reachable, and the content is read from
 * the .pages.dev address of the same deployment (--fallback none switches that off).
 *
 * No dependencies: Node 24 runs this TypeScript file directly. Every check returns pass, warn or
 * fail; only a fail makes the run (and the GitHub workflow) fail.
 */
import { resolveCname, resolveMx, resolveTxt } from 'node:dns/promises';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tls from 'node:tls';
import { pathToFileURL } from 'node:url';

import { ADDRESS_PLACEHOLDERS } from '../src/lib/legal.ts';
import { siteConfig } from '../src/lib/site.ts';

export type Status = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  name: string;
  status: Status;
  detail: string;
}

export interface Page {
  status: number;
  headers: Headers;
  body: string;
  /** Time until the response arrived, in milliseconds */
  milliseconds: number;
}

export interface MailDns {
  mx: string[];
  txt: string[];
  dmarcTxt: string[];
  dmarcCname: string[];
}

export interface LiveCheckOptions {
  baseUrl: string;
  /**
   * Cloudflare's bot protection shows a "Just a moment" challenge to requests from data centers
   * (GitHub's runners). When the custom domain answers with such a challenge, the content is
   * checked at this address instead (the same deployment, without the bot protection).
   */
  fallbackBaseUrl?: string;
  /** Headers every response must carry (from public/_headers) */
  expectedHeaders: Record<string, string>;
  fetch?: typeof fetch;
  now?: () => Date;
  /** End of validity of the TLS certificate of the host */
  certificateEnd?: (host: string) => Promise<Date>;
  /** Expiry date of the domain registration, undefined when it cannot be read */
  domainExpiry?: (domain: string) => Promise<Date | undefined>;
  mailDns?: (domain: string) => Promise<MailDns>;
  /** Check the TLS certificate, the domain registration and the mail DNS records (not for a local run) */
  infrastructure?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/** The Cloudflare Pages address of this site: the same deployment as the custom domain. */
const PAGES_DEV = 'https://leonkrix-dev.pages.dev';

/** The mail provider the mailbox lives at. The DNS records must keep pointing there. */
const MAIL_PROVIDER = 'ionos';

// ---------------------------------------------------------------------------------------------
// Helpers

/** Reads the headers of the "/*" block of public/_headers. */
export function parseHeadersFile(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let inBlock = false;
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }
    if (!/^\s/.test(line)) {
      inBlock = line.trim() === '/*';
      continue;
    }
    const separator = line.indexOf(':');
    if (inBlock && separator > 0) {
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
  }
  return headers;
}

/** True for the challenge page of Cloudflare's bot protection instead of the real page. */
export function isChallenge(page: Pick<Page, 'status' | 'headers' | 'body'>): boolean {
  return (
    page.headers.get('cf-mitigated') === 'challenge' ||
    (page.status === 403 && page.body.includes('Just a moment'))
  );
}

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const ok = (name: string, detail: string): CheckResult => ({ name, status: 'pass', detail });
const warn = (name: string, detail: string): CheckResult => ({ name, status: 'warn', detail });
const fail = (name: string, detail: string): CheckResult => ({ name, status: 'fail', detail });

/** Collects problems; no problems means pass. */
function verdict(name: string, problems: string[], passed: string): CheckResult {
  return problems.length === 0 ? ok(name, passed) : fail(name, problems.join('; '));
}

function daysUntil(date: Date, now: Date): number {
  return Math.floor((date.getTime() - now.getTime()) / DAY);
}

// ---------------------------------------------------------------------------------------------
// The checks

export async function runLiveChecks(options: LiveCheckOptions): Promise<CheckResult[]> {
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const base = new URL(options.baseUrl);
  const host = base.hostname;
  // Where the content is read: the custom domain, or the fallback address when it is challenged
  let contentBase = base;

  async function get(
    path: string,
    init: { method?: string; headers?: Record<string, string>; body?: string } = {},
    url: URL = new URL(path, contentBase),
  ): Promise<Page> {
    const started = Date.now();
    const response = await fetchImpl(url, {
      method: init.method ?? 'GET',
      redirect: 'manual',
      ...(init.headers ? { headers: init.headers } : {}),
      ...(init.body === undefined ? {} : { body: init.body }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body,
      milliseconds: Date.now() - started,
    };
  }

  const results: CheckResult[] = [];
  const run = async (name: string, check: () => Promise<CheckResult>): Promise<void> => {
    try {
      results.push(await check());
    } catch (error) {
      results.push(fail(name, error instanceof Error ? error.message : String(error)));
    }
  };

  await run('custom domain', async () => {
    const probe = await get('/', {}, new URL('/', base));
    if (!isChallenge(probe)) {
      return ok('custom domain', `${host} answers directly`);
    }
    if (options.fallbackBaseUrl === undefined) {
      return fail(
        'custom domain',
        `${host} shows Cloudflare's bot challenge to this check (HTTP ${String(probe.status)}) and no fallback address is set`,
      );
    }
    contentBase = new URL(options.fallbackBaseUrl);
    return ok(
      'custom domain',
      `${host} is reachable, but Cloudflare's bot protection challenged this check (normal for a data center address), so the page content is checked at ${contentBase.hostname}`,
    );
  });

  // The home page is used by several checks
  let home: Page | undefined;
  await run('home page', async () => {
    home = await get('/');
    const title = /<title>([^<]*)<\/title>/.exec(home.body)?.[1] ?? '';
    const problems: string[] = [];
    if (home.status !== 200) {
      problems.push(`HTTP ${String(home.status)} instead of 200`);
    }
    if (!(home.headers.get('content-type') ?? '').includes('text/html')) {
      problems.push('not served as HTML');
    }
    if (!title.includes(siteConfig.name) || !title.includes(siteConfig.role)) {
      problems.push(`unexpected title "${title}"`);
    }
    for (const id of ['about', 'projects', 'experience', 'contact']) {
      if (!home.body.includes(`id="${id}"`)) {
        problems.push(`section #${id} is missing`);
      }
    }
    return verdict('home page', problems, `200, title "${title}", all sections present`);
  });

  await run('security headers', async () => {
    const page = home ?? (await get('/'));
    const problems: string[] = [];
    for (const [name, expected] of Object.entries(options.expectedHeaders)) {
      const actual = page.headers.get(name);
      if (actual === null) {
        problems.push(`${name} is missing`);
      } else if (normalize(actual) !== normalize(expected)) {
        problems.push(`${name} is "${actual}", expected "${expected}"`);
      }
    }
    return verdict(
      'security headers',
      problems,
      `${String(Object.keys(options.expectedHeaders).length)} headers as in public/_headers`,
    );
  });

  await run('content security policy', async () => {
    const page = home ?? (await get('/'));
    const meta =
      /<meta[^>]*http-equiv="content-security-policy"[^>]*content="([^"]*)"/i.exec(
        page.body,
      )?.[1] ?? '';
    const problems: string[] = [];
    for (const directive of ["default-src 'self'", "object-src 'none'", "frame-src 'none'"]) {
      if (!meta.includes(directive)) {
        problems.push(`CSP lacks ${directive}`);
      }
    }
    if (meta.replace(/style-src-attr[^;]*;?/, '').includes('unsafe-inline')) {
      problems.push('CSP contains unsafe-inline outside style-src-attr');
    }
    return verdict('content security policy', problems, 'strict policy in the page');
  });

  await run('page speed', async () => {
    const page = home ?? (await get('/'));
    const detail = `home page answered in ${String(page.milliseconds)} ms`;
    return page.milliseconds > 2500
      ? warn('page speed', detail + ' (slow)')
      : ok('page speed', detail);
  });

  await run('assets', async () => {
    const page = home ?? (await get('/'));
    const css = /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/.exec(page.body)?.[1];
    const script = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(page.body)?.[1];
    const problems: string[] = [];
    if (css === undefined) {
      problems.push('no stylesheet found in the page');
    } else {
      const asset = await get(css);
      if (asset.status !== 200 || !(asset.headers.get('content-type') ?? '').includes('text/css')) {
        problems.push(`stylesheet ${css}: HTTP ${String(asset.status)}`);
      }
      if (!(asset.headers.get('cache-control') ?? '').includes('immutable')) {
        problems.push('stylesheet is not cached as immutable');
      }
    }
    if (script !== undefined) {
      const asset = await get(script);
      if (
        asset.status !== 200 ||
        !(asset.headers.get('content-type') ?? '').includes('javascript')
      ) {
        problems.push(`script ${script}: HTTP ${String(asset.status)}`);
      }
    }
    const image = await get('/og.png');
    if (image.status !== 200 || !(image.headers.get('content-type') ?? '').includes('image/png')) {
      problems.push(`og.png: HTTP ${String(image.status)}`);
    }
    return verdict(
      'assets',
      problems,
      'stylesheet, script and preview image are served and cached',
    );
  });

  await run('redirects', async () => {
    const problems: string[] = [];
    /**
     * A permanent redirect to exactly the expected place: either another origin (http to https, www
     * to the bare domain) or another path on the same host. The Location header is resolved like a
     * browser does, and compared as a parsed address, so "https://leonkrix.dev.example" does not pass
     * for "https://leonkrix.dev".
     */
    const expectRedirect = (
      label: string,
      page: Page,
      from: URL,
      expected: { origin: string } | { path: string },
    ): void => {
      const location = page.headers.get('location') ?? '';
      let target: URL | undefined;
      try {
        target = new URL(location, from);
      } catch {
        target = undefined;
      }
      const permanent = [301, 308].includes(page.status);
      const arrived =
        target !== undefined &&
        ('origin' in expected
          ? target.origin === expected.origin
          : target.origin === from.origin && target.pathname.replace(/\/$/, '') === expected.path);
      if (!permanent || !arrived) {
        const wanted = 'origin' in expected ? expected.origin : expected.path;
        problems.push(
          `${label}: HTTP ${String(page.status)} to "${location}", expected a permanent redirect to ${wanted}`,
        );
      }
    };
    if (base.protocol === 'https:') {
      const insecure = new URL(base);
      insecure.protocol = 'http:';
      expectRedirect('http', await get('/', {}, insecure), insecure, { origin: base.origin });
      if (!host.startsWith('www.') && host.includes('.') && host !== 'localhost') {
        const www = new URL(`https://www.${host}/`);
        expectRedirect('www', await get('/', {}, www), www, { origin: base.origin });
      }
    }
    for (const [old, current] of [
      ['/impressum', '/legal-notice'],
      ['/datenschutz', '/privacy-policy'],
    ] as const) {
      expectRedirect(old, await get(old), new URL(old, contentBase), { path: current });
    }
    return verdict(
      'redirects',
      problems,
      'http, www and the old German legal addresses redirect permanently',
    );
  });

  await run('legal pages', async () => {
    const problems: string[] = [];
    for (const path of ['/legal-notice/', '/privacy-policy/']) {
      const page = await get(path);
      if (page.status !== 200) {
        problems.push(`${path}: HTTP ${String(page.status)}`);
        continue;
      }
      if (!page.body.includes('<meta name="robots" content="noindex">')) {
        problems.push(`${path}: noindex is missing`);
      }
      if (!page.body.includes('lang="en"') || !page.body.includes('lang="de"')) {
        problems.push(`${path}: one of the two language versions is missing`);
      }
      // A production build must never ship placeholders instead of the real address
      for (const placeholder of Object.values(ADDRESS_PLACEHOLDERS)) {
        if (page.body.includes(placeholder)) {
          problems.push(`${path}: contains the placeholder ${placeholder}`);
        }
      }
      if (page.body.includes(siteConfig.email) || page.body.includes('href="mailto:')) {
        problems.push(`${path}: the email address is readable in the HTML`);
      }
    }
    return verdict(
      'legal pages',
      problems,
      'both pages, both languages, no placeholders, address and email obfuscated',
    );
  });

  await run('search engine files', async () => {
    const problems: string[] = [];
    const robots = await get('/robots.txt');
    if (
      robots.status !== 200 ||
      !robots.body.includes('Sitemap:') ||
      !robots.body.includes('GPTBot')
    ) {
      problems.push('robots.txt is missing, has no sitemap or no AI crawler rules');
    }
    const sitemap = await get('/sitemap.xml');
    if (sitemap.status !== 200 || !sitemap.body.includes(`<loc>${siteConfig.url}/</loc>`)) {
      problems.push('sitemap.xml is missing or does not list the home page');
    }
    if (/legal-notice|privacy-policy/.test(sitemap.body)) {
      problems.push('sitemap.xml lists noindex pages');
    }
    return verdict('search engine files', problems, 'robots.txt and sitemap.xml are fine');
  });

  // The Playground pages exist exactly while games are published; the sitemap tells which ones
  await run('playground', async () => {
    const sitemap = await get('/sitemap.xml');
    const paths = [
      ...sitemap.body.matchAll(/<loc>https?:\/\/[^/<]+(\/games\/[^<]*)<\/loc>/g),
    ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
    if (paths.length === 0) {
      return ok('playground', 'no games are published yet, nothing to check');
    }
    const problems: string[] = [];
    const start = home ?? (await get('/'));
    if (!start.body.includes('id="playground"')) {
      problems.push('the home page has no Playground section although games are published');
    }
    for (const path of paths) {
      const game = await get(path);
      const title = /<title>([^<]*)<\/title>/.exec(game.body)?.[1] ?? '';
      if (game.status !== 200) {
        problems.push(`${path}: HTTP ${String(game.status)}`);
        continue;
      }
      if (!title.includes(siteConfig.name)) {
        problems.push(`${path}: unexpected title "${title}"`);
      }
      if (!/<h1[\s>]/.test(game.body)) {
        problems.push(`${path}: no main heading`);
      }
      // A game is a script on the page: the files of the island must be served
      for (const asset of game.body.matchAll(/(?:component-url|renderer-url)="([^"]+)"/g)) {
        const file = asset[1];
        if (file === undefined) {
          continue;
        }
        const script = await get(file);
        if (
          script.status !== 200 ||
          !(script.headers.get('content-type') ?? '').includes('javascript')
        ) {
          problems.push(`${path}: the script ${file} is not served as JavaScript`);
        }
      }
    }
    return verdict(
      'playground',
      problems,
      `${String(paths.length)} game pages, the section on the home page and the game scripts are fine`,
    );
  });

  await run('unknown pages', async () => {
    const page = await get(`/does-not-exist-${String(Date.now())}`);
    const problems: string[] = [];
    if (page.status !== 404) {
      problems.push(`HTTP ${String(page.status)} instead of 404`);
    }
    if (!page.body.includes('Page not found')) {
      problems.push('the custom 404 page is not shown');
    }
    return verdict('unknown pages', problems, 'answers 404 with the custom page');
  });

  await run('contact form API', async () => {
    const page = home ?? (await get('/'));
    if (!page.body.includes('data-contact-form')) {
      return ok('contact form API', 'the form is not on the page, nothing to check');
    }
    const problems: string[] = [];

    const token = await get('/api/contact-token');
    let tokenBody: { ok?: unknown; token?: unknown } = {};
    try {
      tokenBody = JSON.parse(token.body) as { ok?: unknown; token?: unknown };
    } catch {
      problems.push('the token endpoint did not answer JSON');
    }
    if (token.status !== 200 || tokenBody.ok !== true || typeof tokenBody.token !== 'string') {
      problems.push(`token endpoint: HTTP ${String(token.status)}, no token`);
    }
    if (token.headers.get('access-control-allow-origin') !== null) {
      problems.push('the token endpoint allows cross-origin requests');
    }
    if (!(token.headers.get('cache-control') ?? '').includes('no-store')) {
      problems.push('the token endpoint can be cached');
    }

    const crossSite = await get('/api/contact-token', {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    });
    if (crossSite.status !== 403) {
      problems.push(
        `cross-site token request answered HTTP ${String(crossSite.status)} instead of 403`,
      );
    }

    const noOrigin = await get('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (noOrigin.status !== 403) {
      problems.push(
        `a POST without Origin answered HTTP ${String(noOrigin.status)} instead of 403`,
      );
    }

    // The honeypot answer proves the secret, the switch and the KV binding are in place, without
    // sending a mail: the endpoint checks its configuration first and answers "ok" for the bot field.
    const honeypot = await get('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: contentBase.origin },
      body: JSON.stringify({ website: 'live-check' }),
    });
    if (honeypot.status !== 200 || !honeypot.body.includes('"ok":true')) {
      problems.push(
        `the form is not configured: the honeypot probe answered HTTP ${String(honeypot.status)}`,
      );
    }
    return verdict(
      'contact form API',
      problems,
      'token, origin checks and configuration work (no mail sent)',
    );
  });

  if (options.infrastructure !== false) {
    await run('TLS certificate', async () => {
      const end = await (options.certificateEnd ?? certificateEnd)(host);
      const days = daysUntil(end, now());
      const detail = `valid for ${String(days)} more days`;
      if (days < 14) {
        return fail('TLS certificate', detail + ' (renewal is overdue)');
      }
      return days < 30 ? warn('TLS certificate', detail) : ok('TLS certificate', detail);
    });

    await run('domain registration', async () => {
      const domain = host.split('.').slice(-2).join('.');
      const expiry = await (options.domainExpiry ?? domainExpiry)(domain);
      if (expiry === undefined) {
        return warn(
          'domain registration',
          'the expiry date could not be read (registry lookup failed)',
        );
      }
      const days = daysUntil(expiry, now());
      const detail = `${domain} expires in ${String(days)} days (${expiry.toISOString().slice(0, 10)})`;
      if (days < 30) {
        return fail('domain registration', detail + ': renew it at the registrar');
      }
      return days < 60 ? warn('domain registration', detail) : ok('domain registration', detail);
    });

    await run('mail DNS records', async () => {
      const domain = host.split('.').slice(-2).join('.');
      const dns = await (options.mailDns ?? mailDns)(domain);
      const problems: string[] = [];
      if (!dns.mx.some((entry) => entry.includes(MAIL_PROVIDER))) {
        problems.push(
          `no MX record points to ${MAIL_PROVIDER} (found: ${dns.mx.join(', ') || 'none'})`,
        );
      }
      if (!dns.txt.some((entry) => entry.startsWith('v=spf1') && entry.includes(MAIL_PROVIDER))) {
        problems.push('the SPF record is missing or does not include the mail provider');
      }
      if (
        !dns.dmarcTxt.some((entry) => entry.startsWith('v=DMARC1')) &&
        dns.dmarcCname.length === 0
      ) {
        problems.push('there is no DMARC record');
      }
      return verdict(
        'mail DNS records',
        problems,
        'MX, SPF and DMARC still point to the mail provider',
      );
    });
  }

  return results;
}

// ---------------------------------------------------------------------------------------------
// Real network lookups (replaced by fakes in the tests)

function certificateEnd(host: string): Promise<Date> {
  return new Promise((resolvePromise, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host }, () => {
      const { valid_to: validTo } = socket.getPeerCertificate();
      socket.end();
      const end = new Date(validTo);
      if (Number.isNaN(end.getTime())) {
        reject(new Error('the certificate has no readable end date'));
      } else {
        resolvePromise(end);
      }
    });
    socket.setTimeout(15_000, () => {
      socket.destroy(new Error('timeout while reading the certificate'));
    });
    socket.on('error', reject);
  });
}

async function domainExpiry(domain: string): Promise<Date | undefined> {
  for (const url of [
    `https://pubapi.registry.google/rdap/domain/${domain}`,
    `https://rdap.org/domain/${domain}`,
  ]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        continue;
      }
      const body = (await response.json()) as {
        events?: { eventAction?: string; eventDate?: string }[];
      };
      const date = body.events?.find((event) => event.eventAction === 'expiration')?.eventDate;
      if (date !== undefined) {
        return new Date(date);
      }
    } catch {
      // try the next registry
    }
  }
  return undefined;
}

async function mailDns(domain: string): Promise<MailDns> {
  const attempt = async <T>(lookup: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await lookup();
    } catch {
      return fallback;
    }
  };
  const [mx, txt, dmarcTxt, dmarcCname] = await Promise.all([
    attempt(() => resolveMx(domain), []),
    attempt(() => resolveTxt(domain), []),
    attempt(() => resolveTxt(`_dmarc.${domain}`), []),
    attempt(() => resolveCname(`_dmarc.${domain}`), []),
  ]);
  return {
    mx: mx.map((record) => record.exchange.toLowerCase()),
    txt: txt.map((chunks) => chunks.join('')),
    dmarcTxt: dmarcTxt.map((chunks) => chunks.join('')),
    dmarcCname,
  };
}

// ---------------------------------------------------------------------------------------------
// Command line

const ICONS: Record<Status, string> = { pass: 'OK  ', warn: 'WARN', fail: 'FAIL' };
const MARKS: Record<Status, string> = {
  pass: ':white_check_mark:',
  warn: ':warning:',
  fail: ':x:',
};

export function summarize(results: CheckResult[]): {
  text: string;
  markdown: string;
  failed: boolean;
} {
  const text = results.map((r) => `${ICONS[r.status]}  ${r.name}: ${r.detail}`).join('\n');
  const markdown = [
    '| Check | Result |',
    '| --- | --- |',
    ...results.map((r) => `| ${r.name} | ${MARKS[r.status]} ${r.detail.replace(/\|/g, '/')} |`),
  ].join('\n');
  return { text, markdown, failed: results.some((r) => r.status === 'fail') };
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

async function main(): Promise<void> {
  const baseUrl = option('base', siteConfig.url);
  // The same deployment without the bot protection; only used when the custom domain challenges us
  const fallback = option('fallback', baseUrl === siteConfig.url ? PAGES_DEV : 'none');
  const retries = Number(option('retries', '0'));
  const retryDelay = Number(option('retry-delay', '10000'));
  const expectedHeaders = parseHeadersFile(readFileSync(resolve('public', '_headers'), 'utf8'));
  const local = ['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname);

  let results: CheckResult[] = [];
  for (let attemptNumber = 0; attemptNumber <= retries; attemptNumber += 1) {
    results = await runLiveChecks({
      baseUrl,
      expectedHeaders,
      infrastructure: !local,
      ...(fallback === 'none' ? {} : { fallbackBaseUrl: fallback }),
    });
    if (!results.some((r) => r.status === 'fail')) {
      break;
    }
    if (attemptNumber < retries) {
      process.stdout.write(
        `A check failed, trying again in ${String(retryDelay / 1000)} s (a new deployment may still be spreading)...\n`,
      );
      await new Promise((done) => setTimeout(done, retryDelay));
    }
  }

  const { text, markdown, failed } = summarize(results);
  process.stdout.write(`Live check of ${baseUrl}\n\n${text}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Live check of ${baseUrl}\n\n${markdown}\n`);
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
