import { type CSSProperties, type RefObject } from 'react';

import { techCategoryLabels } from '../../shared/tech-term';
import { MAX_TRIES, type Round } from '../logic/round';

interface ResultCardProps {
  round: Round;
  cardRef: RefObject<HTMLDivElement | null>;
  onCopy: () => void;
  onNewRound: () => void;
}

/** What the round ended with: the term, what it means, and what to do next. */
export function ResultCard({ round, cardRef, onCopy, onNewRound }: ResultCardProps) {
  const won = round.status === 'won';
  const tries = round.guesses.length;
  const { term, category, definition } = round.answer;

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className="tw-result"
      data-outcome={round.status}
      style={{ '--len': round.length } as CSSProperties}
    >
      <p className="font-mono text-sm text-accent-2">
        {won
          ? `Solved in ${String(tries)} of ${String(MAX_TRIES)} ${tries === 1 ? 'try' : 'tries'}`
          : 'Out of tries'}
      </p>
      <h2 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-2xl font-bold tracking-wider uppercase">{term}</span>
        <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-muted">
          {techCategoryLabels[category]}
        </span>
      </h2>
      <p className="mt-2 text-muted">{definition}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onNewRound}
          className="btn-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
        >
          New round
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="btn-outline inline-flex items-center rounded-lg px-4 py-2 text-sm text-fg"
        >
          Copy result
        </button>
        <p className="game-prose hidden text-sm sm:block">
          or press <kbd>Enter</kbd>
        </p>
      </div>
    </div>
  );
}
