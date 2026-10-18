import { useEffect, useMemo, useState } from 'react';

import { chapters } from '../data/campaign-plan';
import { loadPool } from '../data/load';
import type { LevelRecord } from '../data/pool';
import BackboneSkeleton from './BackboneSkeleton';
import { Round } from './Round';
import { Star } from './Svg';

type Stars = Readonly<Record<string, 0 | 1 | 2 | 3>>;

function initialLevelId(): string | undefined {
  return new URLSearchParams(window.location.search).get('level') ?? undefined;
}

/**
 * The game: it fetches the levels once the page is painted, lets the player pick a chapter and a
 * level, and plays a round of the chosen level (`Round`, started anew for every level). The stars
 * of this visit are kept here; nothing is stored on the device.
 */
export default function Backbone() {
  const [pool, setPool] = useState<readonly LevelRecord[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [levelId, setLevelId] = useState<string | undefined>(initialLevelId);
  const [stars, setStars] = useState<Stars>({});

  useEffect(() => {
    loadPool().then(setPool, () => {
      setFailed(true);
    });
  }, []);

  const record = useMemo(
    () => pool?.find((entry) => entry.id === levelId) ?? pool?.[0],
    [pool, levelId],
  );

  if (failed) {
    return (
      <BackboneSkeleton message="The levels could not be loaded. Reload the page to try again." />
    );
  }
  if (pool === undefined || record === undefined) {
    return <BackboneSkeleton />;
  }

  const chapterLevels = pool.filter((entry) => entry.chapter === record.chapter);
  const position = pool.findIndex((entry) => entry.id === record.id);

  const openLevel = (id: string): void => {
    setLevelId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('level', id);
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="bb-game">
      <div className="bb-top">
        <label className="bb-chapter">
          <span className="bb-sr">Chapter</span>
          <select
            value={record.chapter}
            onChange={(event) => {
              const first = pool.find((entry) => entry.chapter === Number(event.target.value));
              if (first !== undefined) {
                openLevel(first.id);
              }
            }}
          >
            {chapters
              .filter((entry) => pool.some((candidate) => candidate.chapter === entry.number))
              .map((entry) => (
                <option key={entry.number} value={entry.number}>
                  {entry.title}
                </option>
              ))}
          </select>
        </label>
        <ol className="bb-levels" aria-label="Levels of the chapter">
          {chapterLevels.map((entry, at) => (
            <li key={entry.id}>
              <button
                type="button"
                className="bb-level"
                aria-current={entry.id === record.id ? 'true' : undefined}
                aria-label={`Level ${String(at + 1)}, ${entry.level.title}, ${String(stars[entry.id] ?? 0)} of 3 stars`}
                onClick={() => {
                  openLevel(entry.id);
                }}
              >
                <span aria-hidden="true">{at + 1}</span>
                <span className="bb-level-stars" aria-hidden="true">
                  {[1, 2, 3].map((number) => (
                    <Star key={number} filled={(stars[entry.id] ?? 0) >= number} />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <Round
        key={record.id}
        record={record}
        chapterRule={
          record.id === chapterLevels[0]?.id
            ? chapters.find((entry) => entry.number === record.chapter)?.rule
            : undefined
        }
        solved={(stars[record.id] ?? 0) > 0}
        next={pool[position + 1]}
        onStars={(earned) => {
          setStars((current) => ({
            ...current,
            [record.id]: Math.max(current[record.id] ?? 0, earned) as 0 | 1 | 2 | 3,
          }));
        }}
        onOpen={openLevel}
      />
    </div>
  );
}
