import { type KindInfo } from './types';

/**
 * What the generator needs to know about a skin. The skin decides the words (what a kind of object
 * is called, how a clue is written) and the pictures. The rules and the solver never see it: for
 * them an object is a kind that is either occupiable or not, and a person has a role.
 */
export interface KindDef extends KindInfo {
  /** How many cells the object covers: 1, or 2 for a bed or a cable tray */
  cells: 1 | 2;
  /** How often it is chosen compared with the other kinds of its group */
  weight: number;
}

export interface NamePoolEntry {
  name: string;
  /** A short unique label for the notes, unique inside a level */
  label: string;
}

export type Naming =
  /** People: random names from a pool, no name and no label twice in one level */
  | { style: 'people'; pool: readonly NamePoolEntry[] }
  /** Devices: a prefix per role and a running number, like sw-01, sw-02 and fw-01 */
  | { style: 'devices'; prefixes: Readonly<Record<string, string>> };

/** A kind of room of a skin, like a server room or a break room */
export interface RoomTypeDef {
  id: string;
  /** How the room is called. A map with several rooms of the type numbers them. */
  name: string;
  /** How likely a room is of this type, compared with the other types */
  weight: number;
  /** How well each kind of object fits into the room: more is more likely, 0 never, no entry 0.3 */
  affinity: Readonly<Record<string, number>>;
  /** A long and narrow room: a map has at most one of these */
  corridor?: boolean;
}

export interface Skin {
  id: 'case-file' | 'outage';
  kinds: Readonly<Record<string, KindDef>>;
  roomTypes: readonly RoomTypeDef[];
  /** The roles the suspects can have */
  roles: readonly string[];
  /**
   * The roles the victim can have: roles of its own (a founder) and roles that suspects have too
   * (a developer). In a level nobody else has the role of the victim.
   */
  victimRoles: readonly string[];
  naming: Naming;
}

/** The part of the kinds that goes into a level */
export function kindsOf(skin: Skin): Record<string, KindInfo> {
  return Object.fromEntries(
    Object.entries(skin.kinds).map(([id, { occupiable }]) => [id, { occupiable }]),
  );
}
