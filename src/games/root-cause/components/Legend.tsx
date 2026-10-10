import { useRef } from 'react';

import { type SkinWords } from '../data/words';
import { type Level } from '../logic/types';
import { Glyph } from './Glyph';
import { capitalize } from './text';

interface LegendProps {
  level: Level;
  words: SkinWords;
}

/**
 * What every picture on the map means: the objects of this level, windows, walls, people. It opens
 * in a dialog over the page, so that nothing on the page moves, and closes with Escape, the
 * button, or a click outside.
 */
export function ItemLegend({ level, words }: LegendProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const kinds = [...new Set(level.layout.objects.map((object) => object.kind))];

  return (
    <>
      <button
        type="button"
        title="What the pictures mean"
        onClick={() => {
          dialogRef.current?.showModal();
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        Legend
      </button>
      {/* A click on the dark area around the dialog closes it, Escape works by itself */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <dialog
        ref={dialogRef}
        className="rc-dialog"
        aria-labelledby="rc-legend-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialogRef.current?.close();
          }
        }}
      >
        <div className="rc-dialog-head">
          <h3 id="rc-legend-title">What the pictures mean</h3>
          <button
            type="button"
            className="rc-dialog-close"
            onClick={() => {
              dialogRef.current?.close();
            }}
          >
            Close
          </button>
        </div>
        <ul className="rc-key-list">
          {kinds.map((kind) => {
            const occupiable = level.kinds[kind]?.occupiable === true;
            const noun = words.kinds[kind];
            const name = capitalize((noun?.one ?? kind).replace(/^(an?|the) /, ''));
            return (
              <li key={kind}>
                <span className="rc-key-icon">
                  <Glyph kind={kind} occupiable={occupiable} join={{}} />
                </span>
                <span>
                  <strong>{name}:</strong>{' '}
                  {occupiable
                    ? (noun?.use ?? `${words.people} can be here`)
                    : `blocks the cell, ${words.nobody.toLowerCase()} can be here`}
                </span>
              </li>
            );
          })}
          <li>
            <span className="rc-key-icon rc-key-window" aria-hidden="true">
              <span />
            </span>
            <span>
              <strong>Window:</strong> a bright bar on the edge of a cell
            </span>
          </li>
          <li>
            <span className="rc-key-icon rc-key-wall" aria-hidden="true">
              <span />
            </span>
            <span>
              <strong>Wall:</strong> the edge of the map and the thick lines between rooms
            </span>
          </li>
          <li>
            <span className="rc-key-icon" aria-hidden="true">
              <span className="rc-key-token">A</span>
            </span>
            <span>
              <strong>Suspect:</strong> a round token with the label of the {words.person}
            </span>
          </li>
          <li>
            <span className="rc-key-icon" aria-hidden="true">
              <span className="rc-key-token" data-victim>
                V
              </span>
            </span>
            <span>
              <strong>{capitalize(words.victim)}:</strong> a square token with an amber edge
            </span>
          </li>
          <li>
            <span className="rc-key-icon" aria-hidden="true">
              <svg viewBox="0 0 100 100" className="rc-key-cross">
                <line x1="24" y1="24" x2="76" y2="76" />
                <line x1="76" y1="24" x2="24" y2="76" />
              </svg>
            </span>
            <span>
              <strong>Cross:</strong> {words.nobody.toLowerCase()} is here. A {words.person} on the
              map crosses out their whole row and column by themselves, and nobody else can be
              placed on those crosses.
            </span>
          </li>
          <li>
            <span className="rc-key-icon rc-key-notes" aria-hidden="true">
              <span>ab</span>
            </span>
            <span>
              <strong>Notes:</strong> small labels of the {words.people} who could be in the cell.
              They are hidden for a {words.person} who is placed, and come back when it is taken
              off.
            </span>
          </li>
        </ul>
      </dialog>
    </>
  );
}
