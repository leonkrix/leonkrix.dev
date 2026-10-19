/**
 * The vocabulary of Backbone, independent of how a game looks and of the interface.
 *
 * A level is a network (nodes and links), a list of flows (what has to travel) and one to three
 * situations (what happens while it travels). A plan says, for every flow, how it travels. The
 * stress test (`simulate.ts`) runs a plan through the situations and gives a score.
 *
 * Everything here is plain data (no classes, no functions) so a level can be stored as JSON.
 */

export type NodeKind = 'router' | 'switch' | 'server' | 'client' | 'firewall' | 'radio';

export interface NetNode {
  id: string;
  name: string;
  kind: NodeKind;
  /** The zone of the node (chapter 10), for example "office" or "guests" */
  zone?: string;
  /** Where the node is drawn, in a box of 0 to 100 on both axes */
  x: number;
  y: number;
}

/** A cable between two nodes. Links are undirected and carry traffic in both directions together. */
export interface NetLink {
  id: string;
  a: string;
  b: string;
  /** Units of traffic per step, a whole number */
  capacity: number;
  /** Time a packet needs to cross, a whole number */
  delay: number;
  /** The share of the traffic this link loses, from 0 to 1 */
  loss: number;
  /** What the link costs to build (a link of a level with a Build phase) */
  cost?: number;
  /** The link does not exist until the player builds it (chapter 8) */
  optional?: boolean;
  /** How much traffic of each queue class the link can hold back when it is full (chapter 6) */
  buffer?: number;
}

export type ProfileId = 'voice' | 'control' | 'transaction' | 'video' | 'web' | 'bulk';

/** What a kind of traffic cares about. The table is in `profiles.ts`. */
export interface Profile {
  id: ProfileId;
  name: string;
  /** What one unit of delivered traffic is worth */
  weight: number;
  /** How late the flow may be before it loses value, in units of delay. `undefined`: never late. */
  latencyBudget: number | undefined;
  /** How fast the value falls when later than the budget (1: it is worth nothing at twice the budget) */
  steepness: number;
  /** Value is the delivered share to this power: high for traffic that cannot lose anything */
  lossExponent: number;
  /** The queue on a link, 0 is served first */
  queue: 0 | 1 | 2;
  /** Whether the player may hold the flow back to make room for others */
  throttlable: boolean;
}

export interface Flow {
  id: string;
  name: string;
  source: string;
  target: string;
  profile: ProfileId;
  /** Units of traffic per step in a calm situation */
  demand: number;
  /** Nodes every path of the flow has to pass (a firewall between zones). A path that skips one carries nothing. */
  via?: readonly string[];
}

/** What happens during a situation. `from` is included, `to` is excluded, both are steps. */
export type NetEvent =
  | { kind: 'burst'; flow: string; from: number; to: number; factor: number }
  | { kind: 'down'; link: string; from: number; to: number }
  /** The cable is in range only from `from` to `to` (a radio link): outside that it is not there */
  | { kind: 'range'; link: string; from: number; to: number }
  | { kind: 'lossy'; link: string; from: number; to: number; loss: number }
  | { kind: 'slow'; link: string; from: number; to: number; factor: number }
  | { kind: 'flood'; source: string; target: string; from: number; to: number; rate: number };

export interface Situation {
  id: string;
  name: string;
  steps: number;
  events: readonly NetEvent[];
}

/**
 * Which options of a plan a level offers. The interface shows only these, and the solver only looks
 * at plans that use only these, so a level of chapter 2 is proven with the options of chapter 2.
 */
export interface Rules {
  /** Send one flow over several paths */
  split: boolean;
  /** A path that is taken at once when the main path is cut */
  backup: boolean;
  /** Coded packets that recover loss */
  redundancy: boolean;
  /** Hold bulk traffic back */
  throttle: boolean;
  /** Change the path at a planned step */
  stages: boolean;
  /** Links have buffers: a burst that does not fit waits in a queue (and makes traffic late) */
  queues: boolean;
}

export interface Zone {
  id: string;
  name: string;
}

export interface Level {
  id: string;
  title: string;
  /** Where it takes place and what is going on, a few lines */
  story: string;
  nodes: readonly NetNode[];
  links: readonly NetLink[];
  flows: readonly Flow[];
  situations: readonly Situation[];
  rules: Rules;
  /** What the player may spend on building optional links (chapter 7) */
  budget?: number;
  /** The zones the nodes belong to (chapter 10), for the drawing and the legend */
  zones?: readonly Zone[];
}

/** A path as the nodes it passes, from the source to the target. */
export type NodePath = readonly string[];

export interface WeightedPath {
  nodes: NodePath;
  /** The share of the flow on this path, the shares of a stage add up to 1 */
  share: number;
}

/** From step `from` on, the flow travels like this (until the next stage). */
export interface RouteStage {
  from: number;
  paths: readonly WeightedPath[];
}

export type Redundancy = 0 | 0.25 | 0.5;

export interface FlowPlan {
  /** At least one stage, the first one starts at step 0 */
  stages: readonly RouteStage[];
  /** Taken at once when the path in use is cut; without it the network repairs the route later */
  backup?: NodePath;
  redundancy: Redundancy;
  /** The share of the demand that is sent at all, from 0 to 1 (only for profiles that can be held back) */
  throttle: number;
}

/** A plan has an entry for a flow, or leaves it out (it then carries nothing). */
export type Plan = Readonly<Record<string, FlowPlan>>;

/** A path a flow really used in a step: the planned one, the backup or a repaired one. */
export interface UsedPath {
  links: readonly string[];
  share: number;
  /** The share of the traffic on this path that the cables let through (1: none was dropped for lack of room) */
  kept: number;
}

export interface FlowStepResult {
  /** Units the flow wanted to send in this step (burst and throttle applied) */
  sent: number;
  /** The extra coded packets that were sent as well: 0, 0.25 or 0.5 of the traffic */
  redundancy: number;
  /** The share of the original demand that arrived, 0 to 1 */
  delivered: number;
  /** The time the traffic needed, 0 when nothing arrived */
  latency: number;
  /** The paths the traffic used in this step (none when it was lost) */
  paths: readonly UsedPath[];
  /** The value earned in this step */
  value: number;
  /** The most the flow could have earned */
  maxValue: number;
}

export interface LinkStepResult {
  /** Traffic that wanted to use the link */
  offered: number;
  /** Attack traffic that flooded the link in this step (it is part of `offered`) */
  attack: number;
  /** Traffic waiting in the buffers of the link at the end of the step, and what they can hold */
  queued: number;
  /** The most waiting in one queue class: what the chip "q2/4" shows, next to the room of one buffer */
  fullest: number;
  buffer: number;
  /** Capacity of the link in this step (0 when it is down) */
  capacity: number;
  down: boolean;
  /** The cable is out of range in this step (a radio link that is not there yet or any more): it counts as down */
  absent: boolean;
}

export interface StepResult {
  flows: Readonly<Record<string, FlowStepResult>>;
  links: Readonly<Record<string, LinkStepResult>>;
}

export interface SituationResult {
  situation: string;
  /** 0 to 1: the value earned divided by the most that could have been earned */
  score: number;
  steps: readonly StepResult[];
}

export interface Evaluation {
  /** 0 to 1: the mean of the situations with the worst one counted twice */
  score: number;
  situations: readonly SituationResult[];
}
