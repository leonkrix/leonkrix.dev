import { describe, expect, it } from 'vitest';

import {
  type CheckResult,
  isChallenge,
  type LiveCheckOptions,
  parseHeadersFile,
  runLiveChecks,
  summarize,
} from './live-check';

const BASE = 'https://example.test';
const FALLBACK = 'https://example.pages.test';

/** The URL of a fetch input. Addresses are compared as parsed URLs, never as text prefixes. */
const urlOf = (input: Parameters<typeof fetch>[0]): URL =>
  new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
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
function fakeSite(
  routes: Record<string, Route | Response | undefined> = {},
  base = BASE,
): typeof fetch {
  const defaults: Record<string, Response | Route> = {
    [`GET ${base}/`]: page(HOME),
    [`GET ${base}/_astro/site.css`]: new Response('a{}', {
      headers: {
        'content-type': 'text/css',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    }),
    [`GET ${base}/_astro/site.js`]: new Response('1', {
      headers: { 'content-type': 'text/javascript' },
    }),
    [`GET ${base}/og.png`]: new Response('png', { headers: { 'content-type': 'image/png' } }),
    [`GET http://example.test/`]: new Response('', {
      status: 301,
      headers: { location: `${base}/` },
    }),
    [`GET https://www.example.test/`]: new Response('', {
      status: 301,
      headers: { location: `${base}/` },
    }),
    [`GET ${base}/impressum`]: new Response('', {
      status: 301,
      headers: { location: '/legal-notice' },
    }),
    [`GET ${base}/datenschutz`]: new Response('', {
      status: 301,
      headers: { location: '/privacy-policy' },
    }),
    [`GET ${base}/legal-notice/`]: page(LEGAL),
    [`GET ${base}/privacy-policy/`]: page(LEGAL),
    [`GET ${base}/robots.txt`]: new Response(
      'User-agent: GPTBot\nDisallow: /\nSitemap: https://leonkrix.dev/sitemap.xml',
    ),
    [`GET ${base}/sitemap.xml`]: new Response(
      '<urlset><url><loc>https://leonkrix.dev/</loc></url></urlset>',
    ),
    [`GET ${base}/api/contact-token`]: (init) =>
      init.headers['Sec-Fetch-Site'] === 'cross-site'
        ? new Response('{"ok":false}', { status: 403 })
        : new Response('{"ok":true,"token":"v1.1.x"}', {
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
          }),
    [`POST ${base}/api/contact`]: (init) =>
      init.headers.Origin === undefined
        ? new Response('{"ok":false}', { status: 403 })
        : new Response('{"ok":true}'),
  };

  return (input, init) => {
    const url = urlOf(input).href;
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
      'custom domain',
      'home page',
      'security headers',
      'content security policy',
      'page speed',
      'assets',
      'redirects',
      'legal pages',
      'search engine files',
      'playground',
      'unknown pages',
      'contact form API',
      'TLS certificate',
      'domain registration',
      'mail DNS records',
    ]);
  });

  describe('playground', () => {
    const GAME = `<html><head><title>Tech Words | Leon Krix</title></head><body><h1>Tech Words</h1>
<astro-island component-url="/_astro/game.js" renderer-url="/_astro/client.js"></astro-island></body></html>`;
    const HOME_WITH_PLAYGROUND = HOME.replace(
      '<section id="contact">',
      '<section id="playground"></section><section id="contact">',
    );
    const SITEMAP = `<urlset><url><loc>https://leonkrix.dev/</loc></url><url><loc>https://leonkrix.dev/games/</loc></url><url><loc>https://leonkrix.dev/games/tech-words/</loc></url></urlset>`;
    const script = (): Response =>
      new Response('1', { headers: { 'content-type': 'text/javascript' } });

    function withGames(extra: Record<string, Route | Response | undefined> = {}): typeof fetch {
      return fakeSite({
        [`GET ${BASE}/`]: page(HOME_WITH_PLAYGROUND),
        [`GET ${BASE}/sitemap.xml`]: new Response(SITEMAP),
        [`GET ${BASE}/games/`]: page('<title>Playground | Leon Krix</title><h1>Playground</h1>'),
        [`GET ${BASE}/games/tech-words/`]: page(GAME),
        [`GET ${BASE}/_astro/game.js`]: script(),
        [`GET ${BASE}/_astro/client.js`]: script(),
        ...extra,
      });
    }

    it('has nothing to check while no game is published', async () => {
      const result = find(await runLiveChecks(options()), 'playground');
      expect(result.status).toBe('pass');
      expect(result.detail).toContain('nothing to check');
    });

    it('passes when the section, the pages and the game scripts are there', async () => {
      const result = find(await runLiveChecks(options({ fetch: withGames() })), 'playground');
      expect(result.status).toBe('pass');
      expect(result.detail).toContain('2 game pages');
    });

    it('fails when the home page has no Playground section', async () => {
      const fetchImpl = withGames({ [`GET ${BASE}/`]: page(HOME) });
      const result = find(await runLiveChecks(options({ fetch: fetchImpl })), 'playground');
      expect(result.status).toBe('fail');
      expect(result.detail).toContain('no Playground section');
    });

    it('fails when a game page is missing', async () => {
      const fetchImpl = withGames({
        [`GET ${BASE}/games/tech-words/`]: new Response('Page not found', { status: 404 }),
      });
      const result = find(await runLiveChecks(options({ fetch: fetchImpl })), 'playground');
      expect(result.status).toBe('fail');
      expect(result.detail).toContain('/games/tech-words/: HTTP 404');
    });

    it('fails when a script of the game is not served', async () => {
      const fetchImpl = withGames({
        [`GET ${BASE}/_astro/game.js`]: new Response('Page not found', { status: 404 }),
      });
      const result = find(await runLiveChecks(options({ fetch: fetchImpl })), 'playground');
      expect(result.status).toBe('fail');
      expect(result.detail).toContain('/_astro/game.js is not served as JavaScript');
    });

    it('fails when a game page has no heading or the wrong title', async () => {
      const fetchImpl = withGames({
        [`GET ${BASE}/games/`]: page('<title>Something else</title>'),
      });
      const result = find(await runLiveChecks(options({ fetch: fetchImpl })), 'playground');
      expect(result.status).toBe('fail');
      expect(result.detail).toContain('unexpected title');
      expect(result.detail).toContain('no main heading');
    });
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

  it('fails when a redirect leads to a look-alike address or another host', async () => {
    const lookAlike = fakeSite({
      'GET http://example.test/': new Response('', {
        status: 301,
        headers: { location: 'https://example.test.evil.example/' },
      }),
      [`GET ${BASE}/impressum`]: new Response('', {
        status: 301,
        headers: { location: 'https://evil.example/legal-notice' },
      }),
    });
    const result = find(await runLiveChecks(options({ fetch: lookAlike })), 'redirects');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('http:');
    expect(result.detail).toContain('/impressum');
  });

  it('accepts a redirect with a relative or absolute Location and a trailing slash', async () => {
    const variants = fakeSite({
      [`GET ${BASE}/impressum`]: new Response('', {
        status: 308,
        headers: { location: '/legal-notice/' },
      }),
      [`GET ${BASE}/datenschutz`]: new Response('', {
        status: 301,
        headers: { location: `${BASE}/privacy-policy` },
      }),
    });
    expect(find(await runLiveChecks(options({ fetch: variants })), 'redirects').status).toBe(
      'pass',
    );
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
      calls.push(urlOf(input).href);
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

describe('bot protection of the custom domain', () => {
  /** The custom domain answers every page with Cloudflare's challenge, except the redirects. */
  function challenged(): { fetch: typeof fetch; hosts: Set<string> } {
    const custom = fakeSite({}, BASE);
    const fallback = fakeSite({}, FALLBACK);
    const hosts = new Set<string>();
    const answer: typeof fetch = (input, init) => {
      const url = urlOf(input).href;
      hosts.add(new URL(url).hostname);
      const isRedirectCheck = url === 'http://example.test/' || url === 'https://www.example.test/';
      if (new URL(url).origin === new URL(BASE).origin && !isRedirectCheck) {
        return Promise.resolve(
          new Response('<title>Just a moment...</title>', {
            status: 403,
            headers: { 'cf-mitigated': 'challenge', 'content-type': 'text/html' },
          }),
        );
      }
      return new URL(url).origin === new URL(FALLBACK).origin
        ? fallback(input, init)
        : custom(input, init);
    };
    return { fetch: answer, hosts };
  }

  it('reads the content from the fallback address when the custom domain is challenged', async () => {
    const { fetch: fetchImpl, hosts } = challenged();
    const results = await runLiveChecks(options({ fetch: fetchImpl, fallbackBaseUrl: FALLBACK }));
    expect(results.filter((result) => result.status !== 'pass')).toEqual([]);
    expect(find(results, 'custom domain').detail).toContain('bot protection');
    expect(find(results, 'custom domain').detail).toContain('example.pages.test');
    expect(hosts.has('example.pages.test')).toBe(true);
  });

  it('still checks that http and www redirect on the custom domain itself', async () => {
    const { fetch: fetchImpl } = challenged();
    const results = await runLiveChecks(options({ fetch: fetchImpl, fallbackBaseUrl: FALLBACK }));
    expect(find(results, 'redirects').status).toBe('pass');
  });

  it('fails when the custom domain is challenged and there is no fallback address', async () => {
    const { fetch: fetchImpl } = challenged();
    const results = await runLiveChecks(options({ fetch: fetchImpl }));
    expect(find(results, 'custom domain').status).toBe('fail');
    expect(find(results, 'custom domain').detail).toContain('no fallback');
    expect(find(results, 'home page').status).toBe('fail');
  });

  it('does not use the fallback address when the custom domain answers', async () => {
    const hosts = new Set<string>();
    const inner = fakeSite();
    const spy: typeof fetch = (input, init) => {
      hosts.add(urlOf(input).hostname);
      return inner(input, init);
    };
    const results = await runLiveChecks(options({ fetch: spy, fallbackBaseUrl: FALLBACK }));
    expect(find(results, 'custom domain').detail).toContain('answers directly');
    expect(hosts.has('example.pages.test')).toBe(false);
  });

  it('a broken custom domain is not hidden by the fallback', async () => {
    const down: typeof fetch = (input, init) => {
      const url = urlOf(input).href;
      return new URL(url).origin === new URL(BASE).origin
        ? Promise.reject(new Error('connect ECONNREFUSED'))
        : fakeSite({}, FALLBACK)(input, init);
    };
    const results = await runLiveChecks(options({ fetch: down, fallbackBaseUrl: FALLBACK }));
    expect(find(results, 'custom domain')).toMatchObject({
      status: 'fail',
      detail: 'connect ECONNREFUSED',
    });
  });
});

describe('isChallenge', () => {
  const page = (status: number, body: string, headers: Record<string, string> = {}) => ({
    status,
    body,
    headers: new Headers(headers),
  });

  it('recognizes the challenge by its header or by its page', () => {
    expect(isChallenge(page(403, '', { 'cf-mitigated': 'challenge' }))).toBe(true);
    expect(isChallenge(page(403, '<title>Just a moment...</title>'))).toBe(true);
  });

  it('does not mistake an ordinary page or a plain refusal for a challenge', () => {
    expect(isChallenge(page(200, '<title>Leon Krix</title>'))).toBe(false);
    expect(isChallenge(page(403, '{"ok":false}'))).toBe(false);
    expect(isChallenge(page(404, 'Page not found'))).toBe(false);
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
