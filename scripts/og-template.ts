/**
 * The HTML of the preview cards (see src/lib/og.ts and scripts/generate-og.mjs). A card is a small
 * page that uses the fonts, the colors and the wordmark of the site; Chromium takes a picture of it.
 * Whatever is changed in this file changes every card, and the fingerprint of the cards includes the
 * text of this file, so a test fails until the pictures are made again (pnpm og).
 */
import { OG_HEIGHT, OG_WIDTH, type OgCard } from '../src/lib/og.ts';

export interface Fonts {
  /** file:// addresses of the two font files */
  inter: string;
  mono: string;
}

const escape = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** The part that is the same on every card: fonts, colors, the light and the grid, the wordmark */
const common = (fonts: Fonts): string => `
  @font-face {
    font-family: 'Inter';
    font-weight: 100 900;
    src: url('${fonts.inter}') format('woff2');
  }
  @font-face {
    font-family: 'JetBrains Mono';
    font-weight: 100 800;
    src: url('${fonts.mono}') format('woff2');
  }
  :root {
    --bg: #0a0d12;
    --border: #1e2632;
    --fg: #e6edf3;
    --muted: #8b98a9;
    --accent: #4f8cff;
    --accent-2: #22d3ee;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${String(OG_WIDTH)}px; height: ${String(OG_HEIGHT)}px; background: var(--bg); }
  body {
    position: relative;
    overflow: hidden;
    color: var(--fg);
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  /* The same light and grid as the hero of the site */
  .light {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(900px 420px at 50% -120px, rgba(79, 140, 255, 0.2), transparent 70%),
      radial-gradient(520px 340px at 88% 8%, rgba(34, 211, 238, 0.09), transparent 70%);
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(30, 38, 50, 0.9) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(30, 38, 50, 0.9) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 75% 110% at 90% 0%, #000 0%, rgba(0, 0, 0, 0.5) 45%, transparent 100%);
  }
  .frame {
    position: absolute;
    inset: 0;
    padding: 64px 80px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .wordmark {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 34px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .wordmark svg { width: 40px; height: 40px; }
  .wordmark .cursor { color: var(--accent-2); }
`;

const wordmark = `<div class="wordmark">
      <svg viewBox="0 0 32 32" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 10l7 6-7 6" stroke="#4f8cff"></path>
        <path d="M18 23h6" stroke="#22d3ee"></path>
      </svg>
      <span>leonkrix<span class="cursor">_</span></span>
    </div>`;

const page = (fonts: Fonts, css: string, body: string, script = ''): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${common(fonts)}${css}</style>
</head>
<body>
  <div class="light"></div>
  <div class="grid"></div>
  <div class="frame">
    ${body}
  </div>
  ${script ? `<script>${script}</script>` : ''}
</body>
</html>`;

/** The card of the home page, which is also the card of every page without one of its own */
export function homeHtml(fonts: Fonts, name: string, role: string, domain: string): string {
  return page(
    fonts,
    `
  .hello { font-family: 'JetBrains Mono', monospace; font-size: 28px; color: var(--accent-2); }
  h1 { margin-top: 18px; font-size: 132px; font-weight: 600; line-height: 1; letter-spacing: -0.03em; }
  .role {
    margin-top: 18px;
    font-size: 58px;
    font-weight: 500;
    background: linear-gradient(to right, var(--accent), var(--accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    width: fit-content;
  }
  .domain { font-family: 'JetBrains Mono', monospace; font-size: 28px; color: var(--muted); }
`,
    `${wordmark}
    <div>
      <p class="hello">Hello, I'm</p>
      <h1>${escape(name)}</h1>
      <p class="role">${escape(role)}</p>
    </div>
    <p class="domain">${escape(domain)}</p>`,
  );
}

/**
 * The sizes the title may have, from the biggest, and the number of lines the text may have. The
 * page tries the combinations in this order and takes the first one that fits with room between the
 * parts, so a short title is big and a long title with a long text is smaller (a note has up to
 * seventy characters in the title and two sentences of text). The title never has more than three
 * lines; the generator fails when even the smallest does not fit.
 */
const fitScript = `
  const sizes = [104, 92, 84, 76, 68, 60, 54];
  const root = document.documentElement;
  const part = (name) => document.querySelector(name);
  const gap = (above, below) => below.getBoundingClientRect().top - above.getBoundingClientRect().bottom;
  const fits = (size) => {
    const title = part('.title');
    const room = 54;
    return (
      title.scrollHeight / (size * 1.08) <= 3.5 &&
      gap(part('.top'), part('.middle')) >= room &&
      gap(part('.middle'), part('.address')) >= room
    );
  };
  // The text is cut after a whole word, with an ellipsis, so that it fills the lines it may have
  const text = part('.text');
  const full = text.textContent;
  const words = full.split(' ');
  const trim = (lines) => {
    text.textContent = full;
    let count = words.length;
    while (text.scrollHeight > lines * 32 * 1.4 + 4 && count > 8) {
      count -= 1;
      text.textContent = words.slice(0, count).join(' ').replace(/[,;:.\\s]+$/, '') + '…';
    }
  };
  search: for (const size of sizes) {
    for (const lines of [3, 2]) {
      root.style.setProperty('--title', size + 'px');
      trim(lines);
      if (fits(size)) break search;
    }
  }
`;

/** The card of a note, a game, an overview or the Uses page */
export function cardHtml(fonts: Fonts, card: OgCard): string {
  return page(
    fonts,
    `
  .section { font-family: 'JetBrains Mono', monospace; font-size: 26px; color: var(--muted); }
  .middle { display: flex; flex-direction: column; gap: 22px; }
  .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 28px; color: var(--accent-2); }
  .title {
    font-size: var(--title, 104px);
    font-weight: 600;
    line-height: 1.08;
    letter-spacing: -0.03em;
  }
  .text {
    max-width: 960px;
    font-size: 32px;
    line-height: 1.4;
    color: var(--muted);
  }
  .address { font-family: 'JetBrains Mono', monospace; font-size: 26px; color: var(--muted); }
`,
    `<div class="top">
      ${wordmark}
      <p class="section">${escape(card.section)}</p>
    </div>
    <div class="middle">
      <p class="eyebrow">${escape(card.eyebrow)}</p>
      <h1 class="title">${escape(card.title)}</h1>
      <p class="text">${escape(card.text)}</p>
    </div>
    <p class="address">${escape(card.address)}</p>`,
    fitScript,
  );
}
