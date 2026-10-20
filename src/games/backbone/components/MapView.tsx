import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { type LevelIndex } from '../logic/graph';
import type { Side } from '../logic/labels';
import { delayMs, showsDelay } from '../logic/latency';
import { lossOfCable, percentOf } from '../logic/loss';
import { bufferSize } from '../logic/queues';
import type { RiskKind } from '../logic/text';
import type { LinkStepResult, NetLink, NodePath } from '../logic/types';
import {
  type Direction,
  loadClass,
  loadRatio,
  MAP_HEIGHT,
  MAP_WIDTH,
  nodeInDirection,
  type Packet,
  type Point,
  pointOf,
  polyline,
} from '../logic/view';
import { Svg } from './Svg';

/** A path to draw: the nodes a flow uses, and how much of the flow is on it. */
export interface DrawnRoute {
  flow: string;
  nodes: NodePath;
  share: number;
  /** The route is the one the player is editing */
  active: boolean;
  /** The route is the backup of a flow, drawn dashed */
  backup?: boolean;
}

interface MapViewProps {
  index: LevelIndex;
  /** The load of every link to show */
  loads: Readonly<Record<string, LinkStepResult>> | undefined;
  /** Links whose load would change if the path being drawn were taken: shown as a forecast */
  forecast: Readonly<Record<string, LinkStepResult>>;
  /** Cables a hint points at */
  hinted: ReadonlySet<string>;
  /** The flow to look at: the routes and packets of the others fade. Nothing fades without one. */
  emphasis: string | undefined;
  routes: readonly DrawnRoute[];
  packets: readonly Packet[];
  /** The selected flow's end points are marked */
  source: string | undefined;
  target: string | undefined;
  /** The side of the node where its name, and the "from" and "to" marks, are written */
  /** Nodes the selected flow has to pass and its route does not pass yet (a firewall): they glow */
  mustPass: ReadonlySet<string>;
  /** The node the pointer or the keyboard is on: a cable to build that the drawing would take next is marked */
  hovered: string | undefined;
  /** The stress test is running (the numbers on the cables are what happens now, not a plan) */
  running: boolean;
  nameSides: ReadonlyMap<string, Side>;
  /** The names that sit a little higher, because the numbers of flows are at the node */
  lifted: ReadonlySet<string>;
  /** The nodes whose numbers sit on the top left corner (the right one is too near the border) */
  badgesLeft: ReadonlySet<string>;
  /** Cables something happens to in a situation of the stress test (marked while planning) */
  risks: ReadonlyMap<string, RiskKind>;
  /** For a cable a flood runs over: the node it runs from, so that the marks run the right way */
  attackFrom: ReadonlyMap<string, string>;
  /** Where along every cable its load (and the button that builds it) sits, 0 to 1 */
  loadAt: ReadonlyMap<string, number>;
  sourceSide: Side;
  targetSide: Side;
  /** The path being drawn */
  draft: NodePath | undefined;
  /** The node that has the keyboard focus within the map */
  focused: string;
  onFocus: (node: string) => void;
  /** The node the pointer or the keyboard is on while a path is being drawn */
  onHover: (node: string | undefined) => void;
  /** A node was clicked, tapped or entered while dragging */
  onNode: (node: string) => void;
  /** The drawing can be changed (not during the stress test) */
  editable: boolean;
  /** Cables that can be built but are not (chapter 7), with what is left of the budget */
  unbuilt: readonly NetLink[];
  budgetLeft: number;
  onBuild: (link: string) => void;
}

const LANE_SPACING = 0.9;

function offsetLine(a: Point, b: Point, lane: number): { from: Point; to: Point } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * lane * LANE_SPACING;
  const ny = (dx / length) * lane * LANE_SPACING;
  return { from: { x: a.x + nx, y: a.y + ny }, to: { x: b.x + nx, y: b.y + ny } };
}

const ARROW_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** The numbers of the flows that start (filled) or end (outlined) at a node. */
function badgesOf(
  level: LevelIndex['level'],
  node: string,
): { flow: string; number: number; profile: string; end: boolean }[] {
  return level.flows.flatMap((flow, at) => [
    ...(flow.source === node
      ? [{ flow: flow.id, number: at + 1, profile: flow.profile, end: false }]
      : []),
    ...(flow.target === node
      ? [{ flow: flow.id, number: at + 1, profile: flow.profile, end: true }]
      : []),
  ]);
}

/** For a screen reader: which flows start and end at a node. */
function endsHere(level: LevelIndex['level'], node: string): string {
  const name = (flow: LevelIndex['level']['flows'][number]): string =>
    `flow ${String(level.flows.indexOf(flow) + 1)} (${flow.name})`;
  const starts = level.flows.filter((flow) => flow.source === node).map(name);
  const ends = level.flows.filter((flow) => flow.target === node).map(name);
  return `${starts.length > 0 ? `, starts ${starts.join(', ')}` : ''}${ends.length > 0 ? `, ends ${ends.join(', ')}` : ''}`;
}

/** A point between two values (`at` is 0.5, the middle, unless a placement says otherwise). */
function lerp(from: number, to: number, at = 0.5): number {
  return from + (to - from) * at;
}

/** The width of the thin dashed line that marks what happens to a cable (loss, a cut, a flood). */
const LINE_MARK = 0.55;

function trim(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** A number written on a link: what it carries out of what it can carry. */
function loadLabel(result: LinkStepResult | undefined): string {
  return result === undefined ? '' : `${trim(result.offered)}/${String(result.capacity)}`;
}

/** The delay of a cable in units, longer while it is full (like the stress test counts it). */
function effectiveDelay(delay: number, result: LinkStepResult | undefined): number {
  const load = Math.min(1, loadRatio(result));
  return delay * (1 + load * load);
}

/** The queue of a cable: a small bar and "Q 3/5" (what waits, out of what the queue holds), always there from the chapter about queues on. */
function Queue({ result, size }: { result: LinkStepResult | undefined; size: number }) {
  const waiting = result?.queued ?? 0;
  const share = Math.min(1, waiting / Math.max(size, 1e-9));
  const by = result?.queuedBy ?? [0, 0, 0];
  return (
    <span
      className="bb-link-queue"
      data-fill={share >= 0.999 ? 'full' : waiting > 0.05 ? 'some' : 'empty'}
      role="img"
      aria-label={`Queue ${trim(waiting)} of ${trim(size)}: voice and control ${trim(by[0] ?? 0)}, web, video and payments ${trim(by[1] ?? 0)}, bulk ${trim(by[2] ?? 0)}`}
    >
      <i style={{ '--fill': String(share) } as CSSProperties} />Q {trim(waiting)}/{trim(size)}
    </span>
  );
}

export function MapView({
  index,
  loads,
  forecast,
  hinted,
  emphasis,
  routes,
  packets,
  source,
  target,
  mustPass,
  hovered,
  running,
  nameSides,
  lifted,
  badgesLeft,
  risks,
  attackFrom,
  loadAt,
  sourceSide,
  targetSide,
  draft,
  focused,
  onFocus,
  onHover,
  onNode,
  editable,
  unbuilt,
  budgetLeft,
  onBuild,
}: MapViewProps) {
  const { level } = index;
  const withDelay = showsDelay(level);
  const flowOrder = new Map(level.flows.map((flow, at) => [flow.id, at]));
  const lanes = Math.max(1, level.flows.length);
  const handledRef = useRef(false);
  const draggingRef = useRef<string | undefined>(undefined);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const mapRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<Point | undefined>();
  // Cables that were just built (by a click or by drawing a route over them): their price flashes
  const [bought, setBought] = useState<readonly NetLink[]>([]);
  const unbuiltRef = useRef<readonly NetLink[]>(unbuilt);
  useEffect(() => {
    const now = new Set(unbuilt.map((link) => link.id));
    const gone = unbuiltRef.current.filter((link) => !now.has(link.id));
    unbuiltRef.current = unbuilt;
    if (gone.length === 0) {
      return undefined;
    }
    setBought((list) => [...list, ...gone]);
    const timer = window.setTimeout(() => {
      setBought((list) => list.filter((link) => !gone.includes(link)));
    }, 1600);
    return () => {
      window.clearTimeout(timer);
    };
  }, [unbuilt]);

  // A drag ends wherever the button is released
  useEffect(() => {
    const stop = (): void => {
      draggingRef.current = undefined;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  const nodeAt = (event: ReactPointerEvent | PointerEvent): string | undefined => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    return element?.closest<HTMLElement>('[data-node]')?.dataset.node;
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, node: string): void => {
    const direction = ARROW_DIRECTIONS[event.key];
    if (direction !== undefined) {
      event.preventDefault();
      const next = nodeInDirection(index, node, direction);
      if (next !== undefined) {
        onFocus(next);
        buttonsRef.current.get(next)?.focus();
      }
    }
  };

  const last = draft?.[draft.length - 1];
  const lastPoint = last === undefined ? undefined : polyline(index, [last])[0];
  // The nodes the path can go to next
  const nextNodes = new Set(
    last === undefined
      ? []
      : [
          ...(index.neighbours.get(last) ?? []).map((step) => step.node),
          // A cable that is not built yet can be drawn over too, if the budget pays for it
          ...unbuilt
            .filter(
              (link) => (link.cost ?? 0) <= budgetLeft && (link.a === last || link.b === last),
            )
            .map((link) => (link.a === last ? link.b : link.a)),
        ].filter((node) => draft?.includes(node) !== true),
  );

  // The cable to build that the drawing would build if the player clicked the node the pointer is on
  const lastDrawn = draft?.[draft.length - 1];
  const hot =
    hovered === undefined || lastDrawn === undefined
      ? undefined
      : unbuilt.find(
          (link) =>
            (link.a === lastDrawn && link.b === hovered) ||
            (link.b === lastDrawn && link.a === hovered),
        );

  return (
    <div
      ref={mapRef}
      className="bb-map"
      data-drawing={draft !== undefined}
      style={{ aspectRatio: `${String(MAP_WIDTH)} / ${String(MAP_HEIGHT)}` }}
      onPointerMove={(event) => {
        if (draft === undefined || mapRef.current === null) {
          return;
        }
        const box = mapRef.current.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - box.left) / box.width) * MAP_WIDTH,
          y: ((event.clientY - box.top) / box.height) * MAP_HEIGHT,
        });
      }}
      onPointerLeave={() => {
        setPointer(undefined);
      }}
    >
      <svg
        className="bb-map-svg"
        viewBox={`0 0 ${String(MAP_WIDTH)} ${String(MAP_HEIGHT)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* A data packet: a little box (the shape of the Lucide icon "box", ISC license) */}
          <symbol id="bb-packet-shape" viewBox="0 0 24 24">
            <path
              className="bb-packet-body"
              d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
            />
            <path className="bb-packet-edge" d="m3.3 7 8.7 5 8.7-5M12 22V12" />
          </symbol>
        </defs>
        {unbuilt.map((link) => {
          const a = level.nodes.find((node) => node.id === link.a);
          const b = level.nodes.find((node) => node.id === link.b);
          if (a === undefined || b === undefined) {
            return null;
          }
          const from = pointOf(a);
          const to = pointOf(b);
          return (
            <line
              key={link.id}
              className="bb-link-ghost"
              data-hot={
                link.id === hot?.id ? ((hot.cost ?? 0) <= budgetLeft ? 'yes' : 'no') : undefined
              }
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              strokeWidth={0.7 + link.capacity * 0.17}
            />
          );
        })}
        {level.links.map((link) => {
          const a = level.nodes.find((node) => node.id === link.a);
          const b = level.nodes.find((node) => node.id === link.b);
          if (a === undefined || b === undefined) {
            return null;
          }
          const result = forecast[link.id] ?? loads?.[link.id];
          const ratio = loadRatio(result);
          const down = result?.down === true;
          const from = pointOf(a);
          const to = pointOf(b);
          const width = 0.7 + link.capacity * 0.17;
          return (
            <g
              key={link.id}
              data-down={down}
              data-absent={result?.absent === true}
              data-load={loadClass(ratio)}
              data-lossy={link.loss > 0}
              data-hint={hinted.has(link.id)}
              data-risk={risks.get(link.id)}
            >
              <line
                className="bb-link"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                strokeWidth={width}
              />
              <line
                className="bb-link-load"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                strokeWidth={Math.max(0.5, width * 0.5)}
              />
              {(result?.attack ?? 0) > 0 && (
                // The marks of a flood run the way the flood goes (the drawing runs from the first
                // point to the second)
                <line
                  className="bb-link-attack"
                  x1={attackFrom.get(link.id) === b.id ? to.x : from.x}
                  y1={attackFrom.get(link.id) === b.id ? to.y : from.y}
                  x2={attackFrom.get(link.id) === b.id ? from.x : to.x}
                  y2={attackFrom.get(link.id) === b.id ? from.y : to.y}
                  strokeWidth={LINE_MARK}
                />
              )}
              {link.loss > 0 && (
                <line
                  className="bb-link-lossy"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  strokeWidth={LINE_MARK}
                />
              )}
              {risks.has(link.id) && (
                <line
                  className="bb-link-risk"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  strokeWidth={LINE_MARK}
                />
              )}
            </g>
          );
        })}
        {routes.map((route, at) => {
          const points = polyline(index, route.nodes);
          const lane = (flowOrder.get(route.flow) ?? 0) - (lanes - 1) / 2;
          const profile = level.flows.find((flow) => flow.id === route.flow)?.profile ?? 'web';
          return (
            <g
              // A flow can have several routes and they have no identity of their own

              key={`${route.flow}-${String(at)}`}
              className="bb-route"
              data-profile={profile}
              data-active={route.active}
              data-backup={route.backup === true}
              style={{
                opacity:
                  (0.35 + 0.65 * route.share) *
                  (emphasis === undefined || route.flow === emphasis ? 1 : 0.3),
              }}
            >
              {points.slice(1).map((point, step) => {
                const before = points[step];
                if (before === undefined) {
                  return null;
                }
                const line = offsetLine(before, point, lane);
                return (
                  <line
                    key={`${String(before.x)},${String(before.y)}`}
                    x1={line.from.x}
                    y1={line.from.y}
                    x2={line.to.x}
                    y2={line.to.y}
                    strokeWidth={route.active ? 1.1 : 0.55}
                  />
                );
              })}
            </g>
          );
        })}
        {draft !== undefined && draft.length > 1 && (
          <polyline
            className="bb-draft"
            points={polyline(index, draft)
              .map((point) => `${String(point.x)},${String(point.y)}`)
              .join(' ')}
          />
        )}
        {draft !== undefined && lastPoint !== undefined && pointer !== undefined && (
          <line
            className="bb-draft bb-draft-pointer"
            x1={lastPoint.x}
            y1={lastPoint.y}
            x2={pointer.x}
            y2={pointer.y}
          />
        )}
        {packets.map((packet) => {
          const profile = level.flows.find((flow) => flow.id === packet.flow)?.profile ?? 'web';
          return (
            <use
              key={packet.key}
              href="#bb-packet-shape"
              className="bb-packet"
              data-profile={profile}
              data-dropped={packet.dropped}
              data-coded={packet.coded}
              x={packet.point.x - 1.4 * packet.scale}
              y={packet.point.y - 1.4 * packet.scale}
              width={2.8 * packet.scale}
              height={2.8 * packet.scale}
              opacity={
                packet.opacity * (emphasis === undefined || packet.flow === emphasis ? 1 : 0.18)
              }
            />
          );
        })}
      </svg>

      {bought.map((link) => {
        const a = level.nodes.find((node) => node.id === link.a);
        const b = level.nodes.find((node) => node.id === link.b);
        if (a === undefined || b === undefined) {
          return null;
        }
        const from = pointOf(a);
        const to = pointOf(b);
        return (
          <span
            key={link.id}
            className="bb-bought"
            aria-hidden="true"
            style={{
              left: `${String((lerp(from.x, to.x, loadAt.get(link.id)) / MAP_WIDTH) * 100)}%`,
              top: `${String((lerp(from.y, to.y, loadAt.get(link.id)) / MAP_HEIGHT) * 100)}%`,
            }}
          >
            built −{link.cost ?? 0}
          </span>
        );
      })}

      {unbuilt.map((link) => {
        const a = level.nodes.find((node) => node.id === link.a);
        const b = level.nodes.find((node) => node.id === link.b);
        if (a === undefined || b === undefined) {
          return null;
        }
        const from = pointOf(a);
        const to = pointOf(b);
        const cost = link.cost ?? 0;
        return (
          <button
            key={link.id}
            type="button"
            className="bb-build-label"
            data-hot={
              link.id === hot?.id ? ((hot.cost ?? 0) <= budgetLeft ? 'yes' : 'no') : undefined
            }
            disabled={!editable || cost > budgetLeft}
            title={`Build this cable: capacity ${String(link.capacity)}, cost ${String(cost)}`}
            aria-label={`Build a cable with capacity ${String(link.capacity)} for ${String(cost)}`}
            style={{
              left: `${String((lerp(from.x, to.x, loadAt.get(link.id)) / MAP_WIDTH) * 100)}%`,
              top: `${String((lerp(from.y, to.y, loadAt.get(link.id)) / MAP_HEIGHT) * 100)}%`,
            }}
            onClick={() => {
              onBuild(link.id);
            }}
          >
            +{cost}
          </button>
        );
      })}

      {level.links.map((link) => {
        const a = level.nodes.find((node) => node.id === link.a);
        const b = level.nodes.find((node) => node.id === link.b);
        if (a === undefined || b === undefined) {
          return null;
        }
        const from = pointOf(a);
        const to = pointOf(b);
        const projected = forecast[link.id];
        const result = projected ?? loads?.[link.id];
        const label = loadLabel(result);
        const loss = lossOfCable(level, link, result, running);
        return (
          <span
            key={link.id}
            className="bb-link-label"
            data-link={link.id}
            data-load={loadClass(loadRatio(result))}
            data-down={result?.down === true}
            data-forecast={projected !== undefined}
            data-delay={withDelay || undefined}
            aria-hidden="true"
            style={{
              left: `${String((lerp(from.x, to.x, loadAt.get(link.id)) / MAP_WIDTH) * 100)}%`,
              top: `${String((lerp(from.y, to.y, loadAt.get(link.id)) / MAP_HEIGHT) * 100)}%`,
            }}
          >
            <span className="bb-link-main">
              {result?.down === true
                ? result.absent
                  ? 'away'
                  : 'cut'
                : label || String(link.capacity)}
            </span>
            {result?.down !== true && withDelay && (
              <small className="bb-link-delay">
                {delayMs(effectiveDelay(link.delay, result))} ms
              </small>
            )}
            {result?.down !== true && bufferSize(level, link) > 0 && (
              <Queue result={result} size={bufferSize(level, link)} />
            )}
            {result?.down !== true && loss !== undefined && (
              <small className="bb-link-loss" data-times={loss.atTimes}>
                {percentOf(loss.share)} lost
              </small>
            )}
          </span>
        );
      })}

      {level.nodes.map((node) => {
        const point = pointOf(node);
        const isSource = node.id === source;
        const isTarget = node.id === target;
        const onDraft = draft?.includes(node.id) === true;
        return (
          <button
            key={node.id}
            type="button"
            ref={(element) => {
              if (element === null) {
                buttonsRef.current.delete(node.id);
              } else {
                buttonsRef.current.set(node.id, element);
              }
            }}
            className="bb-node"
            data-node={node.id}
            data-kind={node.kind}
            data-source={isSource}
            data-target={isTarget}
            data-draft={onDraft}
            data-next={nextNodes.has(node.id)}
            data-must={mustPass.has(node.id) || undefined}
            data-zone={node.zone}
            tabIndex={node.id === focused ? 0 : -1}
            disabled={!editable}
            aria-label={`${node.name}, ${node.kind}${isSource ? ', start of the selected flow' : ''}${isTarget ? ', end of the selected flow' : ''}${mustPass.has(node.id) ? ', the selected flow has to pass here' : ''}${endsHere(level, node.id)}`}
            style={{
              left: `${String((point.x / MAP_WIDTH) * 100)}%`,
              top: `${String((point.y / MAP_HEIGHT) * 100)}%`,
            }}
            onFocus={() => {
              onFocus(node.id);
              onHover(node.id);
            }}
            onBlur={() => {
              onHover(undefined);
            }}
            onKeyDown={(event) => {
              handleKey(event, node.id);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 && event.pointerType === 'mouse') {
                return;
              }
              handledRef.current = true;
              draggingRef.current = node.id;
              onNode(node.id);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerEnter={(event) => {
              onHover(node.id);
              // Dragging over the nodes draws the path
              if (draggingRef.current !== undefined && event.buttons === 1) {
                const entered = nodeAt(event);
                if (entered !== undefined && entered !== draggingRef.current) {
                  draggingRef.current = entered;
                  onNode(entered);
                }
              }
            }}
            onPointerLeave={() => {
              onHover(undefined);
            }}
            onClick={() => {
              // A click that follows a pointer press was handled already
              if (handledRef.current) {
                handledRef.current = false;
                return;
              }
              onNode(node.id);
            }}
          >
            <Svg set="node" name={node.kind} className="bb-node-icon" />
            <span
              className="bb-node-badges"
              data-left={badgesLeft.has(node.id) || undefined}
              aria-hidden="true"
            >
              {badgesOf(level, node.id).map((badge) => (
                <span
                  key={`${badge.flow}-${String(badge.end)}`}
                  className="bb-badge"
                  data-profile={badge.profile}
                  data-end={badge.end}
                  data-dim={emphasis !== undefined && badge.flow !== emphasis}
                >
                  {badge.number}
                </span>
              ))}
            </span>
            <span
              className="bb-node-name"
              data-side={nameSides.get(node.id) ?? 'below'}
              data-lift={lifted.has(node.id) || undefined}
            >
              {node.name}
            </span>
            {isSource && (
              <span className="bb-node-tag" data-side={sourceSide}>
                from
              </span>
            )}
            {isTarget && (
              <span className="bb-node-tag" data-side={targetSide}>
                to
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
