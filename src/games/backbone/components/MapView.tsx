import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useRef } from 'react';

import { type LevelIndex } from '../logic/graph';
import { profiles } from '../logic/profiles';
import type { LinkStepResult, NodePath } from '../logic/types';
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

/** A path to draw: the links a flow uses, and how much of the flow is on it. */
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
  routes: readonly DrawnRoute[];
  packets: readonly Packet[];
  /** The selected flow's end points are marked */
  source: string | undefined;
  target: string | undefined;
  /** The path being drawn */
  draft: NodePath | undefined;
  /** The node that has the keyboard focus within the map */
  focused: string;
  onFocus: (node: string) => void;
  /** A node was clicked, tapped or entered while draggingRef */
  onNode: (node: string) => void;
  /** The drawing can be changed (not during the stress test) */
  editable: boolean;
  /** Links that are down in the step shown */
  className?: string;
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

/** A number written on a link: what it carries out of what it can carry. */
function loadLabel(result: LinkStepResult | undefined): string {
  if (result === undefined) {
    return '';
  }
  return `${trim(result.offered)}/${String(result.capacity)}`;
}

function trim(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function MapView({
  index,
  loads,
  routes,
  packets,
  source,
  target,
  draft,
  focused,
  onFocus,
  onNode,
  editable,
  className,
}: MapViewProps) {
  const { level } = index;
  const flowOrder = new Map(level.flows.map((flow, at) => [flow.id, at]));
  const lanes = Math.max(1, level.flows.length);
  const handledRef = useRef(false);
  const draggingRef = useRef<string | undefined>(undefined);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());

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

  const pathOf = (nodes: NodePath): Point[] => polyline(index, nodes);

  return (
    <div
      className={`bb-map ${className ?? ''}`}
      style={{ aspectRatio: `${String(MAP_WIDTH)} / ${String(MAP_HEIGHT)}` }}
    >
      <svg
        className="bb-map-svg"
        viewBox={`0 0 ${String(MAP_WIDTH)} ${String(MAP_HEIGHT)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {level.links.map((link) => {
          const a = level.nodes.find((node) => node.id === link.a);
          const b = level.nodes.find((node) => node.id === link.b);
          if (a === undefined || b === undefined) {
            return null;
          }
          const result = loads?.[link.id];
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
          const points = pathOf(route.nodes);
          const lane = (flowOrder.get(route.flow) ?? 0) - (lanes - 1) / 2;
          const profile = level.flows.find((flow) => flow.id === route.flow)?.profile ?? 'web';
          return (
            <g
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
            points={pathOf(draft)
              .map((point) => `${String(point.x)},${String(point.y)}`)
              .join(' ')}
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

      {level.links.map((link) => {
        const a = level.nodes.find((node) => node.id === link.a);
        const b = level.nodes.find((node) => node.id === link.b);
        if (a === undefined || b === undefined) {
          return null;
        }
        const from = pointOf(a);
        const to = pointOf(b);
        const result = loads?.[link.id];
        const label = loadLabel(result);
        return (
          <span
            key={link.id}
            className="bb-link-label"
            data-load={loadClass(loadRatio(result))}
            data-down={result?.down === true}
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
              // Dragging over the nodes draws the path
              if (draggingRef.current !== undefined && event.buttons === 1) {
                const entered = nodeAt(event);
                if (entered !== undefined && entered !== draggingRef.current) {
                  draggingRef.current = entered;
                  onNode(entered);
                }
              }
            }}
            onPointerUp={() => {
              draggingRef.current = undefined;
            }}
            onPointerCancel={() => {
              draggingRef.current = undefined;
            }}
            onClick={() => {
              // A click that follows a pointer press was handledRef already
              if (handledRef.current) {
                handledRef.current = false;
                return;
              }
              onNode(node.id);
            }}
          >
            <Svg set="node" name={node.kind} className="bb-node-icon" />
            <span className="bb-node-name">{node.name}</span>
            {isSource && <span className="bb-node-tag">from</span>}
            {isTarget && <span className="bb-node-tag">to</span>}
          </button>
        );
      })}
      {/* Profile symbols for the legend of colors live in the flow list, not here */}
      <span hidden>{Object.keys(profiles).length}</span>
    </div>
  );
}
