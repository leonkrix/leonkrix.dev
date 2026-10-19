import type { LevelIndex } from './graph';
import type { Evaluation, Situation } from './types';
import { loadRatio } from './view';

/** Words for the screen: what happens in a step, and what went wrong in a run. */

function linkName(index: LevelIndex, id: string): string {
  const link = index.linkById.get(id);
  const names = new Map(index.level.nodes.map((node) => [node.id, node.name]));
  return link === undefined
    ? id
    : `${names.get(link.a) ?? link.a} – ${names.get(link.b) ?? link.b}`;
}

export interface EventText {
  kind: Situation['events'][number]['kind'];
  text: string;
}

/** What is going on in a step of a situation, one sentence for each event. */
export function eventsAt(index: LevelIndex, situation: Situation, step: number): string[] {
  return eventTexts(index, situation, step).map((event) => event.text);
}

type NetEvent = Situation['events'][number];

/** One event as a sentence: "Core – Hub A is cut". */
function sentenceOf(index: LevelIndex, event: NetEvent): string {
  const nodeName = (id: string): string =>
    index.level.nodes.find((node) => node.id === id)?.name ?? id;
  const flowName = (id: string): string =>
    index.level.flows.find((flow) => flow.id === id)?.name ?? id;
  switch (event.kind) {
    case 'burst':
      return `${flowName(event.flow)} sends ${String(event.factor)} times as much`;
    case 'down':
      return `${linkName(index, event.link)} is cut`;
    case 'lossy':
      return `${linkName(index, event.link)} loses ${String(Math.round(event.loss * 100))} % of its packets`;
    case 'flood':
      return `${nodeName(event.source)} floods ${nodeName(event.target)} with ${String(event.rate)} per minute`;
    case 'slow':
      return `${linkName(index, event.link)} runs at ${String(Math.round(event.factor * 100))} % speed`;
  }
}

/** The end of an event as a sentence: "Core – Hub A is back". */
function endOf(index: LevelIndex, event: NetEvent): string {
  const flowName = (id: string): string =>
    index.level.flows.find((flow) => flow.id === id)?.name ?? id;
  switch (event.kind) {
    case 'burst':
      return `${flowName(event.flow)} is back to normal`;
    case 'down':
      return `${linkName(index, event.link)} is back`;
    case 'lossy':
      return `${linkName(index, event.link)} is clean again`;
    case 'flood':
      return 'the flood stops';
    case 'slow':
      return `${linkName(index, event.link)} is at full speed again`;
  }
}

/** The same sentences with the kind of event, so the screen can colour them. */
export function eventTexts(index: LevelIndex, situation: Situation, step: number): EventText[] {
  return situation.events
    .filter((event) => step >= event.from && step < event.to)
    .map((event) => ({ kind: event.kind, text: sentenceOf(index, event) }));
}

/**
 * What changes in the stress test at a step, for the player who plans a change of path from there:
 * "Core – Hub A is cut", "Core – Hub A is back".
 */
export function describeSwitch(index: LevelIndex, step: number): string {
  const parts = new Set<string>();
  for (const situation of index.level.situations) {
    for (const event of situation.events) {
      if (event.from === step) {
        parts.add(sentenceOf(index, event));
      } else if (event.to === step) {
        parts.add(endOf(index, event));
      }
    }
  }
  return [...parts].slice(0, 2).join(', ');
}

export interface Forecast {
  id: string;
  name: string;
  items: { kind: EventText['kind']; minutes: string; text: string }[];
}

/** The minutes of an event for a sentence: "Minute 3" or "Minutes 3–5" (the stress test counts from 1). */
function minutesOf(event: NetEvent): string {
  return event.to - event.from <= 1
    ? `Minute ${String(event.from + 1)}`
    : `Minutes ${String(event.from + 1)}–${String(event.to)}`;
}

/**
 * What will happen in every situation of the stress test, written out before the player plans:
 * the level hides nothing, a plan is judged on the situations the player can read here.
 */
export function forecastOf(index: LevelIndex): Forecast[] {
  return index.level.situations.map((situation) => ({
    id: situation.id,
    name: situation.name,
    items: [...situation.events]
      .sort((a, b) => a.from - b.from)
      .map((event) => ({
        kind: event.kind,
        minutes: minutesOf(event),
        text: sentenceOf(index, event),
      })),
  }));
}

/** The cables that something happens to in some situation (a cut wins over loss, loss over slowness). */
export function riskyLinks(level: LevelIndex['level']): Map<string, 'down' | 'lossy' | 'slow'> {
  const rank = { slow: 1, lossy: 2, down: 3 } as const;
  const risks = new Map<string, 'down' | 'lossy' | 'slow'>();
  for (const situation of level.situations) {
    for (const event of situation.events) {
      if (event.kind === 'down' || event.kind === 'lossy' || event.kind === 'slow') {
        const known = risks.get(event.link);
        if (known === undefined || rank[event.kind] > rank[known]) {
          risks.set(event.link, event.kind);
        }
      }
    }
  }
  return risks;
}

export interface RunSummary {
  /** The busiest link of the whole run, how full it got (1 is exactly full) and in which situation */
  busiest: { link: string; ratio: number; situation: string } | undefined;
  /** The flow that lost the most, and the share of its value it lost (0 to 1) */
  worstFlow: { flow: string; lost: number } | undefined;
  /** For every flow: the share of its possible value that it earned over the whole run */
  flows: { flow: string; earned: number }[];
}

export function summarize(index: LevelIndex, evaluation: Evaluation): RunSummary {
  let busiest: RunSummary['busiest'];
  const earned = new Map<string, number>();
  const possible = new Map<string, number>();
  for (const [at, situation] of evaluation.situations.entries()) {
    for (const step of situation.steps) {
      for (const [id, result] of Object.entries(step.links)) {
        const ratio = loadRatio(result);
        if (ratio > (busiest?.ratio ?? 0)) {
          busiest = { link: id, ratio, situation: index.level.situations[at]?.name ?? '' };
        }
      }
      for (const [id, result] of Object.entries(step.flows)) {
        earned.set(id, (earned.get(id) ?? 0) + result.value);
        possible.set(id, (possible.get(id) ?? 0) + result.maxValue);
      }
    }
  }
  const flows = index.level.flows.map((flow) => ({
    flow: flow.id,
    earned:
      (possible.get(flow.id) ?? 0) > 0
        ? (earned.get(flow.id) ?? 0) / (possible.get(flow.id) ?? 1)
        : 1,
  }));
  const worst = [...flows].sort((a, b) => a.earned - b.earned)[0];
  return {
    busiest,
    worstFlow:
      worst === undefined || worst.earned > 0.995
        ? undefined
        : { flow: worst.flow, lost: 1 - worst.earned },
    flows,
  };
}

/**
 * The busiest link in words, as a fault of the plan: "Your plan sends more through Core –
 * Gateway than it can carry: 150 % of its capacity".
 */
export function describeBusiest(index: LevelIndex, summary: RunSummary): string {
  if (summary.busiest === undefined || summary.busiest.ratio <= 1 + 1e-9) {
    return 'No cable was overloaded.';
  }
  const where = summary.busiest.situation === '' ? '' : ` (in "${summary.busiest.situation}")`;
  const link = linkName(index, summary.busiest.link);
  return Number.isFinite(summary.busiest.ratio)
    ? `Your plan sends more through ${link} than it can carry: ${String(Math.round(summary.busiest.ratio * 100))} % of its capacity${where}.`
    : `Your plan still sends traffic over ${link} while it is cut${where}.`;
}

/** The overloaded cable in one short sentence, for a hint. */
export function describeOverload(
  index: LevelIndex,
  busiest: { link: string; ratio: number },
): string {
  const link = linkName(index, busiest.link);
  return Number.isFinite(busiest.ratio)
    ? `${link} is asked to carry ${String(Math.round(busiest.ratio * 100))} % of its capacity. The rest is dropped or has to wait.`
    : `${link} is cut, but a flow still uses it.`;
}

export { linkName };
