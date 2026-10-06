import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { ADDRESS_PLACEHOLDERS } from '../../src/lib/legal';
import { navLinks } from '../../src/lib/navigation';
import { availability, siteConfig, socialLinks } from '../../src/lib/site';
import { distDir, type Page, readDistFile, readPages } from './helpers';

/**
 * Checks against the production build in dist/. Run `pnpm build` first (pnpm test:dist).
 */
let pages: Page[] = [];

beforeAll(async () => {
  pages = await readPages();
});

describe('every page', () => {
  it('has lang, title, description and canonical', () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const { file, html } of pages) {
      expect(html, file).toMatch(/<html[^>]*\slang="[a-z-]+"/);
      expect(html, file).toMatch(/<title>[^<]+<\/title>/);
      expect(html, file).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html, file).toMatch(/<link rel="canonical" href="https:\/\/leonkrix\.dev[^"]*"/);
    }
  });

  it('links to Impressum and Datenschutz in the footer', () => {
    for (const { file, html } of pages) {
      expect(html, file).toContain('href="/impressum"');
      expect(html, file).toContain('href="/datenschutz"');
    }
  });

  it('loads no insecure http:// resources', () => {
    for (const { file, html } of pages) {
      expect(html, file).not.toMatch(/(?:src|href)="http:\/\//);
    }
  });
});

describe('navigation', () => {
  it('shows every navigation link in the header of every page', () => {
    for (const { file, html } of pages) {
      for (const link of navLinks) {
        expect(html, file).toContain(`href="${link.href}"`);
      }
    }
  });

  it('points every navigation link to an existing section on the home page', () => {
    const home = pages.find(({ file }) => file.endsWith(join('dist', 'index.html')));
    expect(home, 'home page').toBeDefined();
    for (const link of navLinks) {
      const id = link.href.slice(2);
      expect(home?.html, link.href).toContain(`<section id="${id}"`);
    }
  });

  it('offers a skip link to the main content and every page has a main landmark', () => {
    for (const { file, html } of pages) {
      expect(html, file).toContain('href="#main"');
      expect(html, file).toContain('<main id="main"');
    }
  });
});

describe('external links', () => {
  it('open in a new tab only with noopener noreferrer', () => {
    for (const { file, html } of pages) {
      for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) {
        expect(tag, file).toContain('rel="noopener noreferrer"');
      }
    }
  });
});

describe('projects section', () => {
  const contentDir = join(distDir, '..', 'src', 'content', 'projects');
  const sources = readdirSync(contentDir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => readFileSync(join(contentDir, name), 'utf8'));

  function projectsHtml(): string {
    const home = pages.find(({ file }) => file.endsWith(join('dist', 'index.html')));
    const html = home?.html ?? '';
    const start = html.indexOf('<section id="projects"');
    return html.slice(start, html.indexOf('</section>', start));
  }

  it('renders one card per project entry', () => {
    expect(sources.length).toBeGreaterThan(0);
    expect(projectsHtml().match(/<article\b/g)?.length).toBe(sources.length);
  });

  it('links to GitHub only for public projects', () => {
    const publicCount = sources.filter((source) => /^\s+status: public$/m.test(source)).length;
    const githubLinks = projectsHtml().match(/href="https:\/\/github\.com\//g)?.length ?? 0;
    expect(githubLinks).toBe(publicCount);
  });

  it('lists the projects newest first', () => {
    const titles = [...projectsHtml().matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1]);
    expect(titles[0]).toBe('leonkrix.dev');
    expect(titles.at(-1)).toBe('Grade &amp; Study Tracker');
  });
});

describe('experience section', () => {
  function homeHtml(): string {
    return pages.find(({ file }) => file.endsWith(join('dist', 'index.html')))?.html ?? '';
  }

  function experienceHtml(): string {
    const html = homeHtml();
    const start = html.indexOf('<section id="experience"');
    return html.slice(start, html.indexOf('</section>', start));
  }

  it('lists education before work, newest first', () => {
    const html = experienceHtml();
    expect(html.indexOf('>Education<')).toBeGreaterThan(-1);
    expect(html.indexOf('>Education<')).toBeLessThan(html.indexOf('>Work<'));
    const titles = [...html.matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].map((match) => match[1]);
    expect(titles).toEqual([
      'M.Sc. Information Systems',
      'B.Sc. Information Systems',
      'University teaching assistant',
    ]);
  });

  it('links each thesis to an existing project card', () => {
    const ids = [...experienceHtml().matchAll(/href="#(project-[a-z-]+)"/g)].flatMap(
      (match) => match[1] ?? [],
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(homeHtml(), id).toContain(`id="${id}"`);
    }
  });
});

describe('availability badge', () => {
  it('is shown in the hero and links to the contact section when open', () => {
    const home = pages.find(({ file }) => file.endsWith(join('dist', 'index.html')));
    expect(availability.open).toBe(true);
    expect(home?.html).toContain(availability.label);
    expect(home?.html).toMatch(/<a[^>]*href="#contact"[^>]*>[\s\S]*?Open to opportunities/);
  });
});

describe('contact section', () => {
  it('shows the protected email and the profile links', () => {
    const home = pages.find(({ file }) => file.endsWith(join('dist', 'index.html')));
    const start = home?.html.indexOf('<section id="contact"') ?? -1;
    const section = home?.html.slice(start, home.html.indexOf('</section>', start)) ?? '';
    expect(section).toContain('data-protected-email');
    for (const link of socialLinks) {
      expect(section, link.label).toContain(`href="${link.href}"`);
    }
  });
});

describe('contact form switch', () => {
  // PUBLIC_CONTACT_FORM=true builds the form in (pnpm build:form). Without it, the form must not
  // exist yet: production gets it only after the privacy policy covers it.
  const enabled = process.env.PUBLIC_CONTACT_FORM === 'true';
  const section = (): string => {
    const home = pages.find(({ file }) => file.endsWith(join('dist', 'index.html')));
    const start = home?.html.indexOf('<section id="contact"') ?? -1;
    return home?.html.slice(start, home.html.indexOf('</section>', start)) ?? '';
  };

  it(enabled ? 'contains the form' : 'does not contain the form', () => {
    if (enabled) {
      expect(section()).toContain('data-contact-form');
    } else {
      expect(section()).not.toContain('data-contact-form');
    }
  });

  it.skipIf(!enabled)('starts hidden and cannot send without JavaScript', () => {
    const html = section();
    expect(html).toMatch(/<div data-contact[^>]*\shidden/);
    const form = /<form[^>]*>/.exec(html)?.[0] ?? '';
    // No action or method: without JavaScript a submit would put the message into the URL
    expect(form).not.toMatch(/\saction=/);
    expect(form).not.toMatch(/\smethod=/);
    expect(form).toContain('novalidate');
    expect(html).toContain('name="website"');
  });

  it('never loads anything from another origin', () => {
    for (const { file, html } of pages) {
      expect(html, file).not.toMatch(/\b(?:src|action)="https?:\/\//);
    }
  });
});

describe('link preview image', () => {
  it('every page points to the same absolute og:image and Twitter card', () => {
    for (const { file, html } of pages) {
      expect(html, file).toContain(`<meta property="og:image" content="${siteConfig.url}/og.png">`);
      expect(html, file).toContain(
        `<meta name="twitter:image" content="${siteConfig.url}/og.png">`,
      );
      expect(html, file).toContain('<meta name="twitter:card" content="summary_large_image">');
      expect(html, file).toContain('<meta property="og:image:width" content="1200">');
      expect(html, file).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
    }
  });

  it('og.png is a 1200 x 630 PNG of reasonable size', async () => {
    const png = await readFile(join(distDir, 'og.png'));
    // PNG signature, then the IHDR chunk with width and height
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    // Many platforms refuse or crop huge images
    expect(png.byteLength).toBeLessThan(500 * 1024);
  });
});

describe('search engine files', () => {
  it('robots.txt allows search engines, blocks AI training crawlers and points to the sitemap', async () => {
    const robots = await readDistFile('robots.txt');
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//);
    for (const bot of ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended']) {
      expect(robots, bot).toMatch(new RegExp(`User-agent: ${bot}\\s+Disallow: /`));
    }
    expect(robots).toContain(`Sitemap: ${siteConfig.url}/sitemap.xml`);
  });

  it('sitemap lists the home page but not the noindex pages', async () => {
    const sitemap = await readDistFile('sitemap.xml');
    expect(sitemap).toContain(`<loc>${siteConfig.url}/</loc>`);
    for (const hidden of ['impressum', 'datenschutz', '404']) {
      expect(sitemap, hidden).not.toContain(hidden);
    }
  });

  it('has structured data for the person, without email or address', () => {
    const home = pages.find(({ file }) => file.endsWith(join('dist', 'index.html')));
    const json = /<script type="application\/ld\+json">([^<]+)<\/script>/.exec(
      home?.html ?? '',
    )?.[1];
    expect(json).toBeDefined();
    const data = JSON.parse(json ?? '{}') as Record<string, unknown>;
    expect(data['@type']).toBe('Person');
    expect(data.name).toBe(siteConfig.name);
    expect(json).not.toMatch(/@leonkrix|mailto|street|postalCode/i);
  });
});

describe('404 page', () => {
  it('exists and is not indexed', () => {
    const page = pages.find(({ file }) => file.endsWith('404.html'));
    expect(page).toBeDefined();
    expect(page?.html).toContain('<meta name="robots" content="noindex">');
  });
});

describe('internal links', () => {
  const home = (): Page | undefined =>
    pages.find(({ file }) => file.endsWith(join('dist', 'index.html')));

  function attributeValues(html: string): string[] {
    return [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].flatMap((match) => match[1] ?? []);
  }

  it('point to files that exist in the build', () => {
    for (const { file, html } of pages) {
      for (const value of attributeValues(html)) {
        if (!value.startsWith('/') || value.startsWith('//')) {
          continue;
        }
        const path = value.split('#')[0]?.split('?')[0] ?? '';
        if (path === '' || path === '/') {
          continue;
        }
        const exists = existsSync(join(distDir, path)) || existsSync(join(distDir, `${path}.html`));
        expect(exists, `${file} links to missing ${value}`).toBe(true);
      }
    }
  });

  it('point to anchors that exist on the target page', () => {
    for (const { file, html } of pages) {
      for (const value of attributeValues(html)) {
        const match = /^(\/?)#(.+)$/.exec(value);
        if (match === null) {
          continue;
        }
        const target = match[1] === '/' ? home()?.html : html;
        expect(target, `${file} links to ${value}`).toContain(`id="${match[2] ?? ''}"`);
      }
    }
  });
});

describe('legal pages', () => {
  it('exist', () => {
    expect(existsSync(join(distDir, 'impressum', 'index.html'))).toBe(true);
    expect(existsSync(join(distDir, 'datenschutz', 'index.html'))).toBe(true);
  });

  it('are set to noindex', () => {
    for (const { file, html } of pages) {
      if (file.includes('impressum') || file.includes('datenschutz')) {
        expect(html, file).toContain('<meta name="robots" content="noindex">');
      }
    }
  });
});

describe('privacy policy', () => {
  // The policy must describe exactly what the site does. The contact form section exists in the
  // policy and the Impressum if and only if the form is built in (PUBLIC_CONTACT_FORM=true).
  const formEnabled = process.env.PUBLIC_CONTACT_FORM === 'true';
  const textOf = (name: 'datenschutz' | 'impressum'): string => {
    const html = pages.find(({ file }) => file.includes(name))?.html ?? '';
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ');
  };

  it('always covers hosting, email contact, cookies, rights and the supervisory authority', () => {
    const text = textOf('datenschutz');
    for (const required of [
      'Cloudflare',
      'IONOS',
      'Art. 6 Abs. 1 lit. f DSGVO',
      '§ 25 TDDDG',
      'Auftragsverarbeitungsvertrag',
      'Datenschutz-Aufsichtsbehörde',
      'Widerspruchsrecht',
      'Art. 22 DSGVO',
      'Stand:',
    ]) {
      expect(text, required).toContain(required);
    }
  });

  it('numbers its sections without gaps', () => {
    const html = pages.find(({ file }) => file.includes('datenschutz'))?.html ?? '';
    const numbers = [...html.matchAll(/<h2>(\d+)\./g)].map((match) => Number(match[1]));
    expect(numbers.length).toBeGreaterThan(5);
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  });

  it(
    formEnabled
      ? 'describes the contact form: data, purpose, recipients, storage period'
      : 'does not describe a contact form that does not exist',
    () => {
      const text = textOf('datenschutz');
      const impressum = textOf('impressum');
      if (!formEnabled) {
        expect(text).not.toContain('Kontaktformular');
        expect(impressum).not.toContain('Kontaktformular');
        return;
      }
      for (const required of [
        'Kontaktformular',
        'Workers KV',
        'Hashwert',
        'zwei Stunden',
        'Speicherdauer',
        'Pflicht zur Bereitstellung',
        'Weg Ihrer Nachricht',
        '§ 257 HGB',
        'STARTTLS',
      ]) {
        expect(text, required).toContain(required);
      }
      expect(impressum).toContain('Kontaktformular');
    },
  );
});

describe('contact data protection', () => {
  const forbidden = [
    ...Object.values(ADDRESS_PLACEHOLDERS),
    siteConfig.email,
    ...['IMPRESSUM_STREET', 'IMPRESSUM_ZIP', 'IMPRESSUM_CITY']
      .map((key) => process.env[key]?.trim())
      .filter((value): value is string => value !== undefined && value !== ''),
  ];

  it('never emits the address, placeholders or the email as plain text', () => {
    for (const { file, html } of pages) {
      for (const text of forbidden) {
        expect(html, `${file} contains "${text}"`).not.toContain(text);
      }
    }
  });

  it('never emits a mailto link in the HTML', () => {
    for (const { file, html } of pages) {
      expect(html, file).not.toMatch(/href="mailto:/);
    }
  });
});
