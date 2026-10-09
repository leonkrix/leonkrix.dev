import { skins } from './data/skins';
import { kindsOf } from './logic/skin';
import {
  type Cell,
  type Clue,
  type Layout,
  type Level,
  type Person,
  type Tier,
} from './logic/types';

/**
 * A level as it is stored in `data/levels.json`. It holds what the generator made and nothing that
 * the skin already knows (the kinds of objects are added again when the level is loaded).
 */
export interface LevelRecord {
  id: string;
  skin: 'case-file' | 'outage';
  tier: Tier;
  size: number;
  /** The seed that made this puzzle: the same seed gives the same puzzle */
  seed: string;
  layout: Layout;
  people: Person[];
  clues: Clue[];
  solution: Cell[];
}

/** Turns a stored record back into a level the engine can work with. */
export function toLevel(record: LevelRecord): Level {
  const skin = skins[record.skin];
  return {
    layout: record.layout,
    kinds: kindsOf(skin),
    people: record.people,
    clues: record.clues,
    solution: record.solution,
  };
}
