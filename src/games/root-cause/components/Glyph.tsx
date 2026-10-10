import { type ReactNode } from 'react';

import { OBJECT_ICONS } from '../data/object-icons';
import { type Side } from '../logic/types';

/** Which sides of a cell continue into the next cell of the same object (a sofa, a cable tray) */
export type Join = Readonly<Partial<Record<Side, boolean>>>;

interface GlyphProps {
  kind: string;
  /** Whether people can stand on it: they are drawn as outlines, the others on a solid tile */
  occupiable: boolean;
  join: Join;
}

/**
 * The picture of an object on a 100 by 100 square. Most kinds use an icon of the Lucide set
 * (`data/object-icons.ts`); a rug, a sofa, a desk and a cable tray are our own drawings, because
 * Lucide has no picture of them or they cover two cells and have to continue into the next cell.
 * The kind of an object is also in the label of the cell, so a picture is never the only
 * information. Objects that block their cell sit on a solid tile.
 */
export function Glyph({ kind, occupiable, join }: GlyphProps) {
  const icon = OBJECT_ICONS[kind];
  if (icon !== undefined) {
    return (
      <svg
        viewBox="0 0 100 100"
        className="rc-glyph"
        data-occupiable={occupiable}
        data-icon
        aria-hidden="true"
        focusable="false"
      >
        {!occupiable && (
          <rect className="rc-glyph-tile" x="9" y="9" width="82" height="82" rx="16" />
        )}
        {/* The markup is one of the constants of data/object-icons.ts, never text from outside */}
        <g
          className="rc-icon"
          transform="translate(18 18) scale(2.75)"
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{ __html: icon }}
        />
      </svg>
    );
  }

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
    case 'rug':
      shapes = (
        <>
          <rect x="14" y="24" width="72" height="52" rx="10" />
          <rect x="26" y="36" width="48" height="28" rx="6" strokeDasharray="6 5" />
        </>
      );
      break;
    case 'sofa': {
      // One sofa over two cells: the lines run through the seam without a break, and only the two
      // outer ends are closed with a rounded arm, so the halves read as one piece
      const x0 = toStart ? 0 : 8;
      const x1 = toEnd ? 100 : 92;
      const lineFrom = toStart ? 0 : x0 + 10;
      const lineTo = toEnd ? 100 : x1 - 10;
      shapes = body(
        <>
          <path d={`M ${String(lineFrom)} 20 H ${String(lineTo)}`} />
          <path d={`M ${String(lineFrom)} 76 H ${String(lineTo)}`} />
          <path d={`M ${String(toStart ? 0 : x0 + 14)} 40 H ${String(toEnd ? 100 : x1 - 14)}`} />
          {!toStart && (
            <path
              d={`M ${String(x0 + 10)} 20 Q ${String(x0)} 20 ${String(x0)} 30 V 66 Q ${String(x0)} 76 ${String(x0 + 10)} 76 M ${String(x0 + 14)} 40 V 76`}
            />
          )}
          {!toEnd && (
            <path
              d={`M ${String(x1 - 10)} 20 Q ${String(x1)} 20 ${String(x1)} 30 V 66 Q ${String(x1)} 76 ${String(x1 - 10)} 76 M ${String(x1 - 14)} 40 V 76`}
            />
          )}
        </>,
      );
      break;
    }
    case 'desk':
      shapes = (
        <>
          <rect x="12" y="30" width="76" height="40" rx="6" />
          <line x1="22" y1="70" x2="22" y2="82" />
          <line x1="78" y1="70" x2="78" y2="82" />
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
