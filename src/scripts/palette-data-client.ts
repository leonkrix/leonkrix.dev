import type { PaletteData } from '@/lib/palette-data';

let pending: Promise<PaletteData> | undefined;

/**
 * Fetches what the palette and the terminal know about the site, once. Started together with the
 * code of the palette (so the two arrive in parallel), never with the page itself.
 */
export function loadPaletteData(): Promise<PaletteData> {
  pending ??= fetch('/palette.json').then((response) => {
    if (!response.ok) {
      throw new Error(`palette.json: HTTP ${String(response.status)}`);
    }
    return response.json() as Promise<PaletteData>;
  });
  // A failed request is tried again the next time
  pending.catch(() => {
    pending = undefined;
  });
  return pending;
}
