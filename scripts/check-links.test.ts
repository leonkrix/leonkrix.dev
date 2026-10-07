import { describe, expect, it } from 'vitest';

import { checkLink, checkLinks, extractExternalLinks, fetchPage, summarize } from './check-links';

/** A fetch that answers by "METHOD url" with a status, or throws for the value "error". */
function fakeFetch(answers: Record<string, number | 'error'>): {
  fetch: typeof fetch;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const key = `${init?.method ?? 'GET'} ${url}`;
    calls.push(key);
    const answer = answers[key];
    if (answer === undefined || answer === 'error') {
      return Promise.reject(new Error('connection reset'));
    }
    return Promise.resolve(new Response('', { status: answer }));
  };
  return { fetch: fetchImpl, calls };
}

describe('extractExternalLinks', () => {
  const html = `
    <a href="/#contact">internal</a>
    <a href="https://leonkrix.dev/impressum">own site</a>
    <a href="https://www.leonkrix.dev/x">own site with www</a>
    <a class="a" href="https://github.com/leonkrix" target="_blank">GitHub</a>
    <a href="https://github.com/leonkrix">GitHub again</a>
    <a href="https://www.linkedin.com/in/leon-krix#top">LinkedIn</a>
    <a href="mailto:x@example.com">mail</a>
    <a href="https://example.org/a?b=1&amp;c=2">query</a>
    <link rel="canonical" href="https://leonkrix.dev/">
  `;

  it('finds each external link once, sorted, and ignores the own site, anchors and mail links', () => {
    expect(extractExternalLinks(html, 'leonkrix.dev')).toEqual([
      'https://example.org/a?b=1&c=2',
      'https://github.com/leonkrix',
      'https://www.linkedin.com/in/leon-krix',
    ]);
  });

  it('finds nothing in a page without external links', () => {
    expect(extractExternalLinks('<a href="/x">x</a>', 'leonkrix.dev')).toEqual([]);
  });
});

describe('checkLink', () => {
  it('passes a link that answers with success', async () => {
    const { fetch: fetchImpl } = fakeFetch({ 'HEAD https://github.com/leonkrix': 200 });
    expect(await checkLink('https://github.com/leonkrix', fetchImpl, 0)).toMatchObject({
      status: 'pass',
    });
  });

  it('asks again with GET when a server refuses HEAD', async () => {
    const { fetch: fetchImpl, calls } = fakeFetch({
      'HEAD https://example.org/': 405,
      'GET https://example.org/': 200,
    });
    expect((await checkLink('https://example.org/', fetchImpl, 0)).status).toBe('pass');
    expect(calls).toEqual(['HEAD https://example.org/', 'GET https://example.org/']);
  });

  it('fails a dead link at once, without retrying', async () => {
    const { fetch: fetchImpl, calls } = fakeFetch({ 'HEAD https://example.org/gone': 404 });
    const result = await checkLink('https://example.org/gone', fetchImpl, 2, 0);
    expect(result).toMatchObject({ status: 'fail', detail: 'HTTP 404' });
    expect(calls).toHaveLength(1);
  });

  it('retries a server error and a network error before it fails', async () => {
    const { fetch: fetchImpl, calls } = fakeFetch({ 'HEAD https://example.org/down': 503 });
    const result = await checkLink('https://example.org/down', fetchImpl, 2, 0);
    expect(result.status).toBe('fail');
    expect(calls).toHaveLength(3);

    const broken = fakeFetch({ 'HEAD https://example.org/off': 'error' });
    expect(await checkLink('https://example.org/off', broken.fetch, 1, 0)).toMatchObject({
      status: 'fail',
      detail: 'connection reset',
    });
  });

  it('recovers when a retry succeeds', async () => {
    let attempts = 0;
    const flaky: typeof fetch = () => {
      attempts += 1;
      return Promise.resolve(new Response('', { status: attempts < 2 ? 503 : 200 }));
    };
    expect((await checkLink('https://example.org/', flaky, 2, 0)).status).toBe('pass');
  });

  it('only warns when a site that blocks bots refuses the request', async () => {
    const { fetch: fetchImpl } = fakeFetch({
      'HEAD https://www.linkedin.com/in/x': 403,
      'GET https://www.linkedin.com/in/x': 403,
    });
    const result = await checkLink('https://www.linkedin.com/in/x', fetchImpl, 0);
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('refuses automated requests');
  });

  it('but a bot wall does not hide a really missing page', async () => {
    const { fetch: fetchImpl } = fakeFetch({ 'HEAD https://www.linkedin.com/in/x': 404 });
    expect((await checkLink('https://www.linkedin.com/in/x', fetchImpl, 0)).status).toBe('fail');
  });

  it('warns about rate limiting instead of calling the link dead', async () => {
    const { fetch: fetchImpl } = fakeFetch({ 'HEAD https://example.org/': 429 });
    expect((await checkLink('https://example.org/', fetchImpl, 0)).status).toBe('warn');
  });
});

describe('checkLinks and summarize', () => {
  it('checks every link and reports a failure', async () => {
    const { fetch: fetchImpl } = fakeFetch({
      'HEAD https://a.example/': 200,
      'HEAD https://b.example/': 404,
    });
    const results = await checkLinks(['https://a.example/', 'https://b.example/'], fetchImpl, 0);
    expect(results.map((r) => r.status)).toEqual(['pass', 'fail']);
    const summary = summarize(results);
    expect(summary.failed).toBe(true);
    expect(summary.text).toContain('FAIL  https://b.example/');
    expect(summary.markdown).toContain('| https://a.example/ |');
  });

  it('is not failed when there are only passes and warnings', () => {
    expect(
      summarize([
        { url: 'a', status: 'pass', detail: 'HTTP 200' },
        { url: 'b', status: 'warn', detail: 'blocked' },
      ]).failed,
    ).toBe(false);
  });
});

describe('fetchPage', () => {
  const challenge = () =>
    new Response('<title>Just a moment...</title>', {
      status: 403,
      headers: { 'cf-mitigated': 'challenge' },
    });

  it('reads the custom domain when it answers', async () => {
    const hosts: string[] = [];
    const fetchImpl: typeof fetch = (input) => {
      hosts.push(
        new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
          .hostname,
      );
      return Promise.resolve(new Response('<a href="https://github.com/x">x</a>'));
    };
    expect(await fetchPage('/', fetchImpl)).toContain('github.com');
    expect(hosts).toEqual(['leonkrix.dev']);
  });

  it('falls back to the pages.dev address when the custom domain shows the bot challenge', async () => {
    const hosts: string[] = [];
    const fetchImpl: typeof fetch = (input) => {
      const host = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      ).hostname;
      hosts.push(host);
      return Promise.resolve(
        host === 'leonkrix.dev' ? challenge() : new Response('<p>real page</p>'),
      );
    };
    expect(await fetchPage('/legal-notice/', fetchImpl)).toBe('<p>real page</p>');
    expect(hosts).toEqual(['leonkrix.dev', 'leonkrix-dev.pages.dev']);
  });

  it('fails clearly when both addresses are challenged', async () => {
    await expect(fetchPage('/', () => Promise.resolve(challenge()))).rejects.toThrow(
      'bot protection',
    );
  });

  it('fails on a real error page instead of reading it as content', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(new Response('Not found', { status: 404 }));
    await expect(fetchPage('/missing/', fetchImpl)).rejects.toThrow('HTTP 404');
  });
});
