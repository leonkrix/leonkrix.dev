import catalogJson from '../data/catalog.json';
import type { CatalogEntry } from '../data/pool';
import { LevelSelect } from './LevelSelect';

const catalog = catalogJson as unknown as CatalogEntry[];
const nothing = (): void => undefined;

/**
 * The page for the choice of a level, as the game shows it first. The page renders it on the
 * server as the placeholder of the game, so that the page is exactly as high before the game as
 * after it, at every width, and nothing below it jumps. A game that is opened with a level in the
 * address starts on that level instead, which is another height.
 */
export default function OverviewSkeleton() {
  return (
    <div className="bb-game">
      <LevelSelect catalog={catalog} stars={{}} onPick={nothing} />
    </div>
  );
}
