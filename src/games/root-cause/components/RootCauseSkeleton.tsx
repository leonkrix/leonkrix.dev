import levelsJson from '../data/levels.json';
import { type LevelRecord } from '../pool';
import { LevelSelect } from './LevelSelect';

const records = levelsJson as unknown as LevelRecord[];
const nothing = (): void => undefined;

/**
 * The page for the choice of a level, as the game shows it first. The page renders it on the
 * server as the placeholder of the game, so that the page is exactly as high before the game as
 * after it, at every width, and nothing below it jumps. (The game itself cannot be rendered on the
 * server: it starts a worker.) A game that is opened with a level in the address starts on that
 * level instead, which is another height.
 */
export default function RootCauseSkeleton() {
  return (
    <div>
      <LevelSelect
        records={records}
        setup={{ tier: 'any', size: 'any', skin: 'any' }}
        run={undefined}
        error={undefined}
        onSetup={nothing}
        onStart={nothing}
        onCancel={nothing}
        onPick={nothing}
      />
    </div>
  );
}
