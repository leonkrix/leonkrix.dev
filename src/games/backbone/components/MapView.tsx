import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { type LevelIndex } from '../logic/graph';
import type { Side } from '../logic/labels';
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
  routes: readonly DrawnRoute[];
  packets: readonly Packet[];
  /** The selected flow's end points are marked */
  source: string | undefined;
  target: string | undefined;
  /** The side of the node where its name, and the "from" and "to" marks, are written */
  nameSides: ReadonlyMap<string, Side>;
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

function trim(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** A number written on a link: what it carries out of what it can carry. */
function loadLabel(result: LinkStepResult | undefined): string {
  if (result === undefined) {
    return '';
  }
  const waiting = result.queued > 0.05 ? ` · q${trim(result.queued)}` : '';
  return `${trim(result.offered)}/${String(result.capacity)}${waiting}`;
}

export function MapView({
  index,
  loads,
  forecast,
  hinted,
  routes,
  packets,
  source,
  target,
  nameSides,
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
  const flowOrder = new Map(level.flows.map((flow, at) => [flow.id, at]));
  const lanes = Math.max(1, level.flows.length);
  const handledRef = useRef(false);
  const draggingRef = useRef<string | undefined>(undefined);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const mapRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<Point | undefined>();

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
      : (index.neighbours.get(last) ?? [])
          .map((step) => step.node)
          .filter((node) => draft?.includes(node) !== true),
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
              data-load={loadClass(ratio)}
              data-lossy={link.loss > 0}
              data-hint={hinted.has(link.id)}
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
                <line
                  className="bb-link-attack"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  strokeWidth={width * 0.35}
                />
              )}
              {link.loss > 0 && (
                <line
                  className="bb-link-lossy"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  strokeWidth={width * 0.35}
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
              style={{ opacity: 0.35 + 0.65 * route.share }}
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
            <circle
              key={packet.key}
              className="bb-packet"
              data-profile={profile}
              data-dropped={packet.dropped}
              cx={packet.point.x}
              cy={packet.point.y}
              r={0.95}
              opacity={packet.opacity}
            />
          );
        })}
      </svg>

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
            disabled={!editable || cost > budgetLeft}
            title={`Build this cable: capacity ${String(link.capacity)}, cost ${String(cost)}`}
            aria-label={`Build a cable with capacity ${String(link.capacity)} for ${String(cost)}`}
            style={{
              left: `${String(((from.x + to.x) / 2 / MAP_WIDTH) * 100)}%`,
              top: `${String(((from.y + to.y) / 2 / MAP_HEIGHT) * 100)}%`,
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
        return (
          <span
            key={link.id}
            className="bb-link-label"
            data-load={loadClass(loadRatio(result))}
            data-down={result?.down === true}
            data-forecast={projected !== undefined}
            aria-hidden="true"
            style={{
              left: `${String(((from.x + to.x) / 2 / MAP_WIDTH) * 100)}%`,
              top: `${String(((from.y + to.y) / 2 / MAP_HEIGHT) * 100)}%`,
            }}
          >
            {result?.down === true ? 'cut' : label || String(link.capacity)}
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
            data-zone={node.zone}
            tabIndex={node.id === focused ? 0 : -1}
            disabled={!editable}
            aria-label={`${node.name}, ${node.kind}${isSource ? ', start of the selected flow' : ''}${isTarget ? ', end of the selected flow' : ''}`}
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
            <span className="bb-node-name" data-side={nameSides.get(node.id) ?? 'below'}>
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
