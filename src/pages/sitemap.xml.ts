import type { APIRoute } from 'astro';

import { siteConfig } from '@/lib/site';

// Pages that must not appear in the sitemap (they are noindex or not real content pages)
const excluded = new Set(['404', 'impressum', 'datenschutz']);

const pages = import.meta.glob('./**/*.astro');

/** "./games/index.astro" becomes "/games/", "./index.astro" becomes "/". Dynamic routes are skipped. */
function toPath(file: string): string | undefined {
  const route = file.replace('./', '').replace(/\.astro$/, '');
  if (route.includes('[') || excluded.has(route)) {
    return undefined;
  }
  if (route === 'index') {
    return '/';
  }
  return `/${route.replace(/\/index$/, '')}/`;
}

export const GET: APIRoute = () => {
  const urls = Object.keys(pages)
    .map(toPath)
    .filter((path): path is string => path !== undefined)
    .sort()
    .map((path) => `  <url><loc>${siteConfig.url}${path}</loc></url>`);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
