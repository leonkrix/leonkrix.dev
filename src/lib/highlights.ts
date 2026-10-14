/**
 * The text of a project highlight can contain links to pages of this site, written as
 * `[text](/path/)`. Nothing else is allowed (no other markup, no link to another site), so a
 * highlight stays plain text with an occasional internal link.
 */
export interface HighlightPart {
  text: string;
  /** An address on this site, always starting with a slash */
  href?: string;
}

// The address starts with one slash (two would be another site)
const LINK = /\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)/gu;

/** The text cut into plain pieces and links, in order */
export function highlightParts(text: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let end = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label, href] = match;
    if (label === undefined || href === undefined) {
      continue;
    }
    if (match.index > end) {
      parts.push({ text: text.slice(end, match.index) });
    }
    parts.push({ text: label, href });
    end = match.index + whole.length;
  }
  if (end < text.length) {
    parts.push({ text: text.slice(end) });
  }
  return parts;
}

/** True when the text has no brackets left once the links are written as plain words */
export function hasOnlyInternalLinks(text: string): boolean {
  return !/[[\]]/u.test(text.replace(LINK, '$1'));
}

/** The text as plain words, for a place that cannot show links (for example a description) */
export function plainHighlight(text: string): string {
  return text.replace(LINK, '$1');
}
