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

/** What is going on in a step of a situation, one sentence for each event. */
export function eventsAt(index: LevelIndex, situation: Situation, step: number): string[] {
  const flowName = (id: string): string =>
    index.level.flows.find((flow) => flow.id === id)?.name ?? id;
  return situation.events
    .filter((event) => step >= event.from && step < event.to)
    .map((event) => {
      switch (event.kind) {
        case 'burst':
          return `${flowName(event.flow)} sends ${String(event.factor)} times as much`;
        case 'down':
          return `${linkName(index, event.link)} is cut`;
        case 'lossy':
          return `${linkName(index, event.link)} loses ${String(Math.round(event.loss * 100))} % of its packets`;
        case 'slow':
          return `${linkName(index, event.link)} runs at ${String(Math.round(event.factor * 100))} % speed`;
      }
    });
}

export interface RunSummary {
  /** The busiest link of the whole run and how full it got (1 is exactly full) */
  busiest: { link: string; ratio: number } | undefined;
  /** The flow that lost the most, and the share of its value it lost (0 to 1) */
  worstFlow: { flow: string; lost: number } | undefined;
  /** For every flow: the share of its possible value that it earned over the whole run */
  flows: { flow: string; earned: number }[];
}

export function summarize(index: LevelIndex, evaluation: Evaluation): RunSummary {
  let busiest: RunSummary['busiest'];
  const earned = new Map<string, number>();
  const possible = new Map<string, number>();
  for (const situation of evaluation.situations) {
    for (const step of situation.steps) {
      for (const [id, result] of Object.entries(step.links)) {
        const ratio = loadRatio(result);
        if (ratio > (busiest?.ratio ?? 0)) {
          busiest = { link: id, ratio };
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

/** The busiest link in words: "Core – Gateway got 150 % of what it carries". */
export function describeBusiest(index: LevelIndex, summary: RunSummary): string {
  if (summary.busiest === undefined || summary.busiest.ratio <= 1 + 1e-9) {
    return 'No link was overfull.';
  }
  const percent = Number.isFinite(summary.busiest.ratio)
    ? `${String(Math.round(summary.busiest.ratio * 100))} % of its capacity`
    : 'traffic while it was cut';
  return `${linkName(index, summary.busiest.link)} got ${percent}.`;
}

export { linkName };
