import { useEffect, useMemo, useRef, useState } from 'react';

import catalogJson from '../data/catalog.json';
import { chapters } from '../data/chapters';
import { loadPool } from '../data/load';
import type { CatalogEntry, LevelRecord } from '../data/pool';
import { isRandom, seedOf, type Tier, tierOf, tiers } from '../logic/tiers';
import BackboneSkeleton from './BackboneSkeleton';
import { LevelSelect } from './LevelSelect';
import { Round } from './Round';
import { Star } from './Svg';
import { useGenerator } from './useGenerator';

type Stars = Readonly<Record<string, 0 | 1 | 2 | 3>>;

const catalog = catalogJson as unknown as readonly CatalogEntry[];

/** What the address asks for: nothing (the overview), a level of the campaign, or a random level. */
type Where =
  | { kind: 'overview' }
  | { kind: 'level'; id: string }
  | { kind: 'random'; tier: Tier; seed: string };

function whereFromAddress(): Where {
  const query = new URLSearchParams(window.location.search);
  const level = query.get('level');
  if (level === 'random') {
    const tier = Number(query.get('tier'));
    const seed = query.get('seed');
    if (seed !== null && seed !== '' && tier >= 1 && tier <= 5) {
      return { kind: 'random', tier: tier as Tier, seed };
    }
    return { kind: 'overview' };
  }
  return level === null ? { kind: 'overview' } : { kind: 'level', id: level };
}

/**
 * The game. Without a level in the address it shows the overview of the campaign (made from the
 * small catalog, so it is there at once); with one it plays that level, once the level pool has
 * been fetched (after the page is painted). A random level is made in background threads and its
 * address holds the tier and the seed that worked. The overview and the levels are pages of their
 * own: the address changes and the back button works. The stars of this visit are kept here;
 * nothing is stored on the device.
 */
export default function Backbone() {
  const [pool, setPool] = useState<readonly LevelRecord[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [where, setWhere] = useState<Where>(whereFromAddress);
  const [stars, setStars] = useState<Stars>({});
  const [tier, setTier] = useState<Tier>(1);
  const [random, setRandom] = useState<LevelRecord | undefined>();
  const randomIdRef = useRef<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const address = (query: Record<string, string> | undefined): void => {
    const url = new URL(window.location.href);
    url.search = '';
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }
    window.history.pushState(null, '', url);
    window.scrollTo({ top: 0 });
  };

  const generator = useGenerator((record) => {
    randomIdRef.current = record.id;
    setRandom(record);
    const level = { kind: 'random', tier: tierOf(record), seed: seedOf(record) } as const;
    setWhere(level);
    address({ level: 'random', tier: String(level.tier), seed: level.seed });
  });

  // The level pool is only fetched when a level of the campaign is opened: the overview needs the
  // small catalog only, and the first load of the page stays small
  const needsPool = where.kind === 'level';
  useEffect(() => {
    if (needsPool) {
      loadPool().then(setPool, () => {
        setFailed(true);
      });
    }
  }, [needsPool]);

  // The back and forward buttons of the browser
  useEffect(() => {
    const sync = (): void => {
      setWhere(whereFromAddress());
    };
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('popstate', sync);
    };
  }, []);

  // A random level in the address (a shared link, or the back button) is made again from its seed
  const wanted = where.kind === 'random' ? where : undefined;
  const wantedTier = wanted?.tier;
  const wantedSeed = wanted?.seed;
  const { startExact } = generator;
  useEffect(() => {
    if (
      wantedTier !== undefined &&
      wantedSeed !== undefined &&
      randomIdRef.current !== `random-${String(wantedTier)}-${wantedSeed}`
    ) {
      startExact(wantedTier, wantedSeed);
    }
    // Only when the address asks for another level
  }, [wantedTier, wantedSeed, startExact]);

  const record = useMemo(
    () => (where.kind === 'level' ? pool?.find((entry) => entry.id === where.id) : undefined),
    [pool, where],
  );

  const showOverview = (): void => {
    generator.cancel();
    setWhere({ kind: 'overview' });
    address(undefined);
  };
  const showLevel = (id: string): void => {
    setWhere({ kind: 'level', id });
    address({ level: id });
  };
  const addStars = (id: string, earned: 0 | 1 | 2 | 3): void => {
    setStars((current) => ({
      ...current,
      [id]: Math.max(current[id] ?? 0, earned) as 0 | 1 | 2 | 3,
    }));
  };

  const overview = (
    <LevelSelect
      catalog={catalog}
      stars={stars}
      onPick={showLevel}
      random={{
        tier,
        onTier: setTier,
        running: generator.running,
        error: generator.error,
        onStart: () => {
          generator.start(tier);
        },
        onCancel: generator.cancel,
      }}
    />
  );

  if (
    where.kind === 'overview' ||
    (where.kind === 'level' && !catalog.some((entry) => entry.id === where.id))
  ) {
    return <div className="bb-game">{overview}</div>;
  }
  if (failed && where.kind === 'level') {
    return (
      <BackboneSkeleton
        message="The levels could not be loaded. Reload the page to try again."
        onAll={showOverview}
      />
    );
  }

  // A random level
  if (where.kind === 'random') {
    if (generator.running || random?.id !== `random-${String(where.tier)}-${where.seed}`) {
      return (
        <BackboneSkeleton
          message={generator.error ?? 'Making a level for you. This takes a few seconds...'}
          onAll={showOverview}
        />
      );
    }
    return (
      <div className="bb-game">
        <div className="bb-top">
          <a
            className="bb-all"
            href="?"
            onClick={(event) => {
              event.preventDefault();
              showOverview();
            }}
          >
            All levels
          </a>
          <p className="bb-where">
            <span>Random level</span>
            <strong>{tiers[where.tier - 1]?.name}</strong>
          </p>
          <button
            type="button"
            className="bb-copy"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(
                () => {
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                  }, 2000);
                },
                () => undefined,
              );
            }}
          >
            {copied ? 'Link copied' : 'Copy link to this level'}
          </button>
        </div>
        <div className="bb-body">
          <Round
            key={random.id}
            record={random}
            chapterRule={undefined}
            solved={(stars[random.id] ?? 0) > 0}
            next={{
              label: 'Another random level',
              onClick: () => {
                generator.start(where.tier);
              },
            }}
            onStars={(earned) => {
              addStars(random.id, earned);
            }}
          />
        </div>
      </div>
    );
  }

  if (pool === undefined || record === undefined) {
    return <BackboneSkeleton onAll={showOverview} />;
  }

  const chapterLevels = pool.filter((entry) => entry.chapter === record.chapter);
  const chapter = chapters.find((entry) => entry.number === record.chapter);
  const chapterNumber = chapters
    .filter((entry) => pool.some((candidate) => candidate.chapter === entry.number))
    .findIndex((entry) => entry.number === record.chapter);
  const following = pool[pool.findIndex((entry) => entry.id === record.id) + 1];

  return (
    <div className="bb-game">
      <div className="bb-top">
        <a
          className="bb-all"
          href="?"
          onClick={(event) => {
            event.preventDefault();
            showOverview();
          }}
        >
          All levels
        </a>
        <p className="bb-where">
          <span>Chapter {chapterNumber + 1}</span>
          <strong>{chapter?.title}</strong>
        </p>
        <ol className="bb-levels" aria-label="Levels of the chapter">
          {chapterLevels.map((entry, at) => (
            <li key={entry.id}>
              <button
                type="button"
                className="bb-level"
                aria-current={entry.id === record.id ? 'true' : undefined}
                aria-label={`Level ${String(at + 1)}, ${entry.level.title}, ${String(stars[entry.id] ?? 0)} of 3 stars`}
                onClick={() => {
                  showLevel(entry.id);
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

      <div className="bb-body">
        <Round
          key={record.id}
          record={record}
          chapterRule={record.id === chapterLevels[0]?.id ? chapter?.rule : undefined}
          solved={(stars[record.id] ?? 0) > 0}
          next={
            following === undefined || isRandom(following.id)
              ? undefined
              : {
                  label: 'Next level',
                  onClick: () => {
                    showLevel(following.id);
                  },
                }
          }
          onStars={(earned) => {
            addStars(record.id, earned);
          }}
        />
      </div>
    </div>
  );
}
