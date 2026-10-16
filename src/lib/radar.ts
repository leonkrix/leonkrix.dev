/**
 * The radar (Konami code, the command `radar`): a beam turns around the middle of the screen, and
 * what is worth a look on the page lights up when the beam reaches it. "Worth a look" is decided by
 * hand: an element carries `data-radar="Label"`, nothing is guessed. The pure parts are here, the
 * DOM part is `src/scripts/radar.ts`.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** How long the beam takes for one turn */
export const SWEEP_MS = 2200;

/** The direction of the middle of a box as seen from the middle of the screen: degrees clockwise from the top, 0 up to 360 */
export function angleOf(box: Box, viewport: Viewport): number {
  const dx = box.x + box.width / 2 - viewport.width / 2;
  const dy = box.y + box.height / 2 - viewport.height / 2;
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

/** When the beam (it starts at the top and turns clockwise) reaches a direction */
export function pingDelay(angle: number, sweepMs: number = SWEEP_MS): number {
  return Math.round((angle / 360) * sweepMs);
}

/** A box that has a size and is at least partly on the screen */
export function isOnScreen(box: Box, viewport: Viewport): boolean {
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.x < viewport.width &&
    box.y < viewport.height &&
    box.x + box.width > 0 &&
    box.y + box.height > 0
  );
}

/** The first of every label (two things with the same label are one find) */
export function uniqueByLabel<T extends { label: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter(({ label }) => {
    if (label.trim() === '' || seen.has(label)) {
      return false;
    }
    seen.add(label);
    return true;
  });
}

/** What the radar says when it is done */
export function summary(count: number): string {
  if (count === 0) {
    return 'The radar found nothing special on this page: it is just text.';
  }
  return `The radar found ${String(count)} ${count === 1 ? 'thing' : 'things'} worth a look on this page.`;
}
