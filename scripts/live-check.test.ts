import { describe, expect, it } from 'vitest';

import {
  type CheckResult,
  type LiveCheckOptions,
  parseHeadersFile,
  runLiveChecks,
  summarize,
} from './live-check';

const BASE = 'https://example.test';
const NOW = new Date('2026-10-07T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const EXPECTED_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

const CSP =
  "default-src 'self'; object-src 'none'; frame-src 'none'; style-src-attr 'unsafe-inline'; script-src 'self' 'sha256-abc'";

const HOME = `<!doctype html><html lang="en"><head><title>Leon Krix | Software Engineer</title>
<meta http-equiv="content-security-policy" content="${CSP}">
<link rel="stylesheet" href="/_astro/site.css"><script type="module" src="/_astro/site.js"></script></head>
<body><section id="about"></section><section id="projects"></section><section id="experience"></section>
<section id="contact"><div data-contact-form></div></section></body></html>`;

const LEGAL = `<html><head><meta name="robots" content="noindex"></head><body>
<section lang="en" id="en">Leon Krix</section><section lang="de" id="de">Leon Krix</section></body></html>`;

type Route = (init: { method: string; headers: Record<string, string> }) => Response | undefined;

function page(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...EXPECTED_HEADERS,
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
    ...(init.status === undefined ? {} : { status: init.status }),
  });
}

/** A fake of the whole site. `routes` replaces answers by "METHOD url". */
function fakeSite(routes: Record<string, Route | Response | undefined> = {}): typeof fetch {
  const defaults: Record<string, Response | Route> = {
    [`GET ${BASE}/`]: page(HOME),
    [`GET ${BASE}/_astro/site.css`]: new Response('a{}', {
      headers: {
        'content-type': 'text/css',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    }),
    [`GET ${BASE}/_astro/site.js`]: new Response('1', {
      headers: { 'content-type': 'text/javascript' },
    }),
    [`GET ${BASE}/og.png`]: new Response('png', { headers: { 'content-type': 'image/png' } }),
    [`GET http://example.test/`]: new Response('', {
      status: 301,
      headers: { location: `${BASE}/` },
    }),
    [`GET https://www.example.test/`]: new Response('', {
      status: 301,
      headers: { location: `${BASE}/` },
    }),
    [`GET ${BASE}/impressum`]: new Response('', {
      status: 301,
      headers: { location: '/legal-notice' },
    }),
    [`GET ${BASE}/datenschutz`]: new Response('', {
      status: 301,
      headers: { location: '/privacy-policy' },
    }),
    [`GET ${BASE}/legal-notice/`]: page(LEGAL),
    [`GET ${BASE}/privacy-policy/`]: page(LEGAL),
    [`GET ${BASE}/robots.txt`]: new Response(
      'User-agent: GPTBot\nDisallow: /\nSitemap: https://leonkrix.dev/sitemap.xml',
    ),
    [`GET ${BASE}/sitemap.xml`]: new Response(
      '<urlset><url><loc>https://leonkrix.dev/</loc></url></urlset>',
    ),
    [`GET ${BASE}/api/contact-token`]: (init) =>
      init.headers['Sec-Fetch-Site'] === 'cross-site'
        ? new Response('{"ok":false}', { status: 403 })
        : new Response('{"ok":true,"token":"v1.1.x"}', {
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
          }),
    [`POST ${BASE}/api/contact`]: (init) =>
      init.headers.Origin === undefined
        ? new Response('{"ok":false}', { status: 403 })
        : new Response('{"ok":true}'),
  };

  return (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;
    const answer = key in routes ? routes[key] : defaults[key];
    if (answer === undefined && !(key in routes) && !(key in defaults)) {
      // Anything unknown is a 404 with the custom page, like the real site
      return Promise.resolve(new Response('Page not found', { status: 404 }));
    }
    if (answer === undefined) {
      return Promise.reject(new Error(`no answer for ${key}`));
    }
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    // Keep the original header casing for the lookups above
    for (const [name, value] of Object.entries(
      (init?.headers as Record<string, string> | undefined) ?? {},
    )) {
      headers[name] = value;
    }
    const response = typeof answer === 'function' ? answer({ method, headers }) : answer.clone();
    return Promise.resolve(response ?? new Response('', { status: 500 }));
  };
}

function options(overrides: Partial<LiveCheckOptions> = {}): LiveCheckOptions {
  return {
    baseUrl: BASE,
    expectedHeaders: EXPECTED_HEADERS,
    fetch: fakeSite(),
    now: () => NOW,
    certificateEnd: () => Promise.resolve(new Date(NOW.getTime() + 80 * DAY)),
    domainExpiry: () => Promise.resolve(new Date(NOW.getTime() + 300 * DAY)),
    mailDns: () =>
      Promise.resolve({
        mx: ['mx00.ionos.de', 'mx01.ionos.de'],
        txt: ['v=spf1 include:_spf-eu.ionos.com ~all'],
        dmarcTxt: ['v=DMARC1; p=none;'],
        dmarcCname: [],
      }),
    ...overrides,
  };
}

const find = (results: CheckResult[], name: string): CheckResult => {
  const result = results.find((entry) => entry.name === name);
  if (result === undefined) {
    throw new Error(`no result named ${name}`);
  }
  return result;
};

describe('runLiveChecks', () => {
  it('passes a healthy site without any warning', async () => {
    const results = await runLiveChecks(options());
    expect(results.filter((result) => result.status !== 'pass')).toEqual([]);
    expect(results.map((result) => result.name)).toEqual([
      'home page',
      'security headers',
      'content security policy',
      'page speed',
      'assets',
      'redirects',
      'legal pages',
      'search engine files',
      'unknown pages',
      'contact form API',
      'TLS certificate',
      'domain registration',
      'mail DNS records',
    ]);
  });

  it('fails when a security header is missing or has a different value', async () => {
    const missing = fakeSite({
      [`GET ${BASE}/`]: new Response(HOME, {
        headers: {
          'content-type': 'text/html',
          'x-frame-options': 'DENY',
          'x-content-type-options': 'nosniff',
        },
      }),
    });
    const result = find(await runLiveChecks(options({ fetch: missing })), 'security headers');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('strict-transport-security is missing');

    const different = fakeSite({
      [`GET ${BASE}/`]: page(HOME, { headers: { 'x-frame-options': 'SAMEORIGIN' } }),
    });
    expect(
      find(await runLiveChecks(options({ fetch: different })), 'security headers').detail,
    ).toContain('x-frame-options is "SAMEORIGIN"');
  });

  it('fails when the content security policy is weakened', async () => {
    const weak = fakeSite({
      [`GET ${BASE}/`]: page(
        HOME.replace("default-src 'self'", "default-src 'self' 'unsafe-inline'"),
      ),
    });
    const result = find(await runLiveChecks(options({ fetch: weak })), 'content security policy');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('unsafe-inline');
  });

  it('fails when the home page is not the site', async () => {
    const wrong = fakeSite({ [`GET ${BASE}/`]: page('<title>Parked domain</title>') });
    const result = find(await runLiveChecks(options({ fetch: wrong })), 'home page');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('unexpected title');
    expect(result.detail).toContain('section #about is missing');
  });

  it('fails when a legal page still shows the address placeholder', async () => {
    const placeholder = fakeSite({
      [`GET ${BASE}/legal-notice/`]: page(LEGAL.replace('Leon Krix', 'Leon Krix [PLZ]')),
    });
    const result = find(await runLiveChecks(options({ fetch: placeholder })), 'legal pages');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('[PLZ]');
  });

  it('fails when the email address is readable in a legal page', async () => {
    const leak = fakeSite({
      [`GET ${BASE}/privacy-policy/`]: page(
        LEGAL + '<a href="mailto:hello@leonkrix.dev">hello@leonkrix.dev</a>',
      ),
    });
    const result = find(await runLiveChecks(options({ fetch: leak })), 'legal pages');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('email address is readable');
  });

  it('fails when one of the two languages is missing from a legal page', async () => {
    const onlyGerman = fakeSite({
      [`GET ${BASE}/legal-notice/`]: page(LEGAL.replace('lang="en"', 'lang="fr"')),
    });
    expect(
      find(await runLiveChecks(options({ fetch: onlyGerman })), 'legal pages').detail,
    ).toContain('language versions');
  });

  it('fails when the old German addresses no longer redirect', async () => {
    const gone = fakeSite({ [`GET ${BASE}/impressum`]: new Response('', { status: 404 }) });
    const result = find(await runLiveChecks(options({ fetch: gone })), 'redirects');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('/impressum');
  });

  it('fails when http does not redirect to https', async () => {
    const open = fakeSite({ [`GET http://example.test/`]: new Response('hello') });
    expect(find(await runLiveChecks(options({ fetch: open })), 'redirects').detail).toContain(
      'http:',
    );
  });

  it('notices a form that is not configured (the honeypot probe is refused)', async () => {
    const broken = fakeSite({
      [`POST ${BASE}/api/contact`]: (init) =>
        init.headers.Origin === undefined
          ? new Response('{"ok":false}', { status: 403 })
          : new Response('{"ok":false,"error":"unavailable"}', { status: 503 }),
    });
    const result = find(await runLiveChecks(options({ fetch: broken })), 'contact form API');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('not configured');
  });

  it('fails when the API accepts cross-site requests, allows CORS or can be cached', async () => {
    const open = fakeSite({
      [`GET ${BASE}/api/contact-token`]: () =>
        new Response('{"ok":true,"token":"t"}', {
          headers: { 'access-control-allow-origin': '*' },
        }),
    });
    const result = find(await runLiveChecks(options({ fetch: open })), 'contact form API');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('cross-origin');
    expect(result.detail).toContain('can be cached');
    expect(result.detail).toContain('cross-site token request');
  });

  it('does not touch the API while the form is not on the page', async () => {
    const calls: string[] = [];
    const inner = fakeSite({
      [`GET ${BASE}/`]: page(HOME.replace('data-contact-form', 'nothing')),
    });
    const spy: typeof fetch = (input, init) => {
      calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      return inner(input, init);
    };
    const result = find(await runLiveChecks(options({ fetch: spy })), 'contact form API');
    expect(result.status).toBe('pass');
    expect(calls.some((call) => call.includes('/api/'))).toBe(false);
  });

  it('turns a network error into a failed check instead of crashing', async () => {
    const down: typeof fetch = () => Promise.reject(new Error('connect ECONNREFUSED'));
    const results = await runLiveChecks(options({ fetch: down }));
    expect(find(results, 'home page')).toMatchObject({
      status: 'fail',
      detail: 'connect ECONNREFUSED',
    });
    expect(results.filter((result) => result.status === 'fail').length).toBeGreaterThan(5);
  });

  it('warns about a certificate that is running out, and fails when renewal is overdue', async () => {
    const days = (count: number) => () => Promise.resolve(new Date(NOW.getTime() + count * DAY));
    expect(
      find(await runLiveChecks(options({ certificateEnd: days(20) })), 'TLS certificate').status,
    ).toBe('warn');
    expect(
      find(await runLiveChecks(options({ certificateEnd: days(10) })), 'TLS certificate').status,
    ).toBe('fail');
  });

  it('warns and fails before the domain registration runs out', async () => {
    const days = (count: number) => () => Promise.resolve(new Date(NOW.getTime() + count * DAY));
    expect(
      find(await runLiveChecks(options({ domainExpiry: days(50) })), 'domain registration').status,
    ).toBe('warn');
    const expiring = find(
      await runLiveChecks(options({ domainExpiry: days(20) })),
      'domain registration',
    );
    expect(expiring.status).toBe('fail');
    expect(expiring.detail).toContain('renew');
  });

  it('only warns when the registry lookup fails', async () => {
    const result = find(
      await runLiveChecks(options({ domainExpiry: () => Promise.resolve(undefined) })),
      'domain registration',
    );
    expect(result.status).toBe('warn');
  });

  it('fails when the mail records no longer point to the mail provider', async () => {
    const mailDns =
      (change: Partial<Awaited<ReturnType<NonNullable<LiveCheckOptions['mailDns']>>>>) => () =>
        Promise.resolve({
          mx: ['mx00.ionos.de'],
          txt: ['v=spf1 include:_spf-eu.ionos.com ~all'],
          dmarcTxt: ['v=DMARC1; p=none;'],
          dmarcCname: [],
          ...change,
        });
    expect(
      find(
        await runLiveChecks(options({ mailDns: mailDns({ mx: ['mail.example.com'] }) })),
        'mail DNS records',
      ).detail,
    ).toContain('MX');
    expect(
      find(await runLiveChecks(options({ mailDns: mailDns({ txt: [] }) })), 'mail DNS records')
        .detail,
    ).toContain('SPF');
    expect(
      find(await runLiveChecks(options({ mailDns: mailDns({ dmarcTxt: [] }) })), 'mail DNS records')
        .detail,
    ).toContain('DMARC');
    // A DMARC CNAME (as IONOS sets it up) counts as well
    expect(
      find(
        await runLiveChecks(
          options({ mailDns: mailDns({ dmarcTxt: [], dmarcCname: ['dmarc.ionos.de'] }) }),
        ),
        'mail DNS records',
      ).status,
    ).toBe('pass');
  });

  it('leaves out the infrastructure checks for a local run', async () => {
    const results = await runLiveChecks(options({ infrastructure: false }));
    expect(results.map((result) => result.name)).not.toContain('TLS certificate');
    expect(results.map((result) => result.name)).not.toContain('domain registration');
    expect(results.map((result) => result.name)).not.toContain('mail DNS records');
  });
});

describe('parseHeadersFile', () => {
  it('reads the headers of the "/*" block and ignores comments and other blocks', () => {
    const text = [
      '# Security headers',
      '',
      '/*',
      '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
      '  Permissions-Policy: camera=(), microphone=()',
      '',
      '# cache',
      '/_astro/*',
      '  Cache-Control: public, max-age=31536000, immutable',
    ].join('\n');
    expect(parseHeadersFile(text)).toEqual({
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'permissions-policy': 'camera=(), microphone=()',
    });
  });

  it('reads the real public/_headers file with the headers we rely on', async () => {
    const { readFileSync } = await import('node:fs');
    const headers = parseHeadersFile(readFileSync('public/_headers', 'utf8'));
    for (const name of [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'content-security-policy',
    ]) {
      expect(Object.keys(headers), name).toContain(name);
    }
  });
});

describe('summarize', () => {
  const results: CheckResult[] = [
    { name: 'a', status: 'pass', detail: 'fine' },
    { name: 'b', status: 'warn', detail: 'slow | very' },
  ];

  it('is not failed with only passes and warnings, and escapes table separators', () => {
    const summary = summarize(results);
    expect(summary.failed).toBe(false);
    expect(summary.text).toContain('WARN  b');
    expect(summary.markdown).toContain('slow / very');
  });

  it('is failed as soon as one check fails', () => {
    expect(summarize([...results, { name: 'c', status: 'fail', detail: 'broken' }]).failed).toBe(
      true,
    );
  });
});
