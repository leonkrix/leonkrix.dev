import { type ReactNode } from 'react';

import { type Side } from '../logic/types';

/** Which sides of a cell continue into the next cell of the same object (a sofa, a cable tray) */
export type Join = Readonly<Partial<Record<Side, boolean>>>;

interface GlyphProps {
  kind: string;
  /** Whether people can stand on it: they are drawn as outlines, the others as solid shapes */
  occupiable: boolean;
  join: Join;
}

/**
 * Simple pictures of the objects, our own drawings on a 100 by 100 square. They are plain shapes
 * (rectangles, circles, lines) so that they need no icon set. The skins' own icons come with the
 * polish; the kind of an object is also in the label of the cell, so a picture is never the only
 * information.
 */
export function Glyph({ kind, occupiable, join }: GlyphProps) {
  const vertical = join.n === true || join.s === true;
  const toEnd = vertical ? join.s === true : join.e === true;
  const toStart = vertical ? join.n === true : join.w === true;
  const left = toStart ? 0 : 10;
  const right = toEnd ? 100 : 90;
  const body = (children: ReactNode): ReactNode => (
    <g transform={vertical ? 'rotate(90 50 50)' : undefined}>{children}</g>
  );

  let shapes: ReactNode;
  switch (kind) {
    case 'chair':
      shapes = (
        <>
          <rect x="30" y="48" width="40" height="28" rx="6" />
          <rect x="30" y="24" width="40" height="16" rx="4" />
        </>
      );
      break;
    case 'rug':
      shapes = (
        <>
          <rect x="14" y="24" width="72" height="52" rx="10" />
          <rect x="26" y="36" width="48" height="28" rx="6" strokeDasharray="6 5" />
        </>
      );
      break;
    case 'sofa':
      shapes = body(
        <>
          <rect x={left} y="34" width={right - left} height="42" rx="10" />
          <rect x={left} y="20" width={right - left} height="18" rx="6" />
          <line x1={(left + right) / 2} y1="42" x2={(left + right) / 2} y2="72" />
        </>,
      );
      break;
    case 'desk':
      shapes = (
        <>
          <rect x="12" y="30" width="76" height="40" rx="6" />
          <line x1="22" y1="70" x2="22" y2="82" />
          <line x1="78" y1="70" x2="78" y2="82" />
        </>
      );
      break;
    case 'screen':
      shapes = (
        <>
          <rect x="18" y="22" width="64" height="42" rx="5" />
          <line x1="50" y1="64" x2="50" y2="76" />
          <line x1="34" y1="78" x2="66" y2="78" />
        </>
      );
      break;
    case 'plant':
      shapes = (
        <>
          <path d="M36 68 H64 L60 84 H40 Z" />
          <circle cx="50" cy="38" r="16" />
          <circle cx="36" cy="50" r="12" />
          <circle cx="64" cy="50" r="12" />
        </>
      );
      break;
    case 'shelf':
      shapes = (
        <>
          <rect x="18" y="14" width="64" height="72" rx="4" />
          <line x1="18" y1="38" x2="82" y2="38" />
          <line x1="18" y1="62" x2="82" y2="62" />
        </>
      );
      break;
    case 'crate':
      shapes = (
        <>
          <rect x="18" y="18" width="64" height="64" rx="4" />
          <line x1="18" y1="18" x2="82" y2="82" />
          <line x1="82" y1="18" x2="18" y2="82" />
        </>
      );
      break;
    case 'printer':
      shapes = (
        <>
          <rect x="14" y="38" width="72" height="34" rx="6" />
          <rect x="28" y="20" width="44" height="18" rx="2" />
          <circle cx="74" cy="52" r="3" />
        </>
      );
      break;
    case 'rack':
      shapes = (
        <>
          <rect x="26" y="10" width="48" height="80" rx="4" />
          <line x1="26" y1="30" x2="74" y2="30" />
          <line x1="26" y1="50" x2="74" y2="50" />
          <line x1="26" y1="70" x2="74" y2="70" />
          <circle cx="36" cy="20" r="2.5" />
          <circle cx="36" cy="40" r="2.5" />
          <circle cx="36" cy="60" r="2.5" />
          <circle cx="36" cy="80" r="2.5" />
        </>
      );
      break;
    case 'tray':
      shapes = body(
        <>
          <line x1={left} y1="34" x2={right} y2="34" />
          <line x1={left} y1="66" x2={right} y2="66" />
          {[20, 36, 52, 68, 84].map((x) => (
            <line key={x} x1={x} y1="34" x2={x} y2="66" />
          ))}
        </>,
      );
      break;
    case 'patch':
      shapes = (
        <>
          <rect x="12" y="28" width="76" height="44" rx="4" />
          {[24, 38, 52, 66, 80].map((x) => (
            <g key={x}>
              <circle cx={x} cy="42" r="3.5" />
              <circle cx={x} cy="58" r="3.5" />
            </g>
          ))}
        </>
      );
      break;
    case 'radiator':
      shapes = (
        <>
          <rect x="16" y="24" width="68" height="52" rx="4" />
          {[30, 42, 54, 66, 78].map((x) => (
            <line key={x} x1={x} y1="32" x2={x} y2="68" />
          ))}
        </>
      );
      break;
    case 'fan':
      shapes = (
        <>
          <circle cx="50" cy="50" r="32" />
          <circle cx="50" cy="50" r="5" />
          <path d="M50 45 C40 25 60 20 52 45" />
          <path d="M54 52 C74 50 76 70 54 56" />
          <path d="M46 54 C32 70 22 52 44 50" />
        </>
      );
      break;
    case 'ups':
      shapes = (
        <>
          <rect x="24" y="14" width="52" height="72" rx="6" />
          <path d="M54 28 L40 54 H52 L46 74 L62 46 H50 Z" />
        </>
      );
      break;
    case 'cabinet':
      shapes = (
        <>
          <rect x="24" y="12" width="52" height="76" rx="4" />
          <line x1="50" y1="12" x2="50" y2="88" />
          <circle cx="44" cy="50" r="2.5" />
          <circle cx="56" cy="50" r="2.5" />
        </>
      );
      break;
    default:
      shapes = <rect x="24" y="24" width="52" height="52" rx="6" />;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className="rc-glyph"
      data-occupiable={occupiable}
      aria-hidden="true"
      focusable="false"
    >
      {shapes}
    </svg>
  );
}
