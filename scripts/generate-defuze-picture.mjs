/**
 * Makes the picture of the Defuze card (`src/components/project-art/Defuze.astro`): the keyframes
 * of ten players, the crosses of the dead, the bomb and the bar, with the times worked out from the
 * paths, the speeds and the events (who dies when, when the bomb is planted). Change the numbers
 * here and make the file again, never change the generated file by hand:
 *
 *   node scripts/generate-defuze-picture.mjs          writes the file
 *   node scripts/generate-defuze-picture.mjs --check  fails if the file is not what this script makes
 *                                                     (a test runs it, so the two cannot drift apart)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { format, resolveConfig } from 'prettier';

// ---- The timeline, in seconds (the loop is 12 seconds) ----
const D = 12;
const SPEED = 44; // units per second when running to the site, the same for every player
const WANDER_SPEED = 10; // units per second for the small steps (everybody keeps moving)
const START = 4.9; // the players start to run
// Who dies when: two kills nearly at the same time, then spread out, one more shortly after the plant
const KILLS = { ct0: 7.8, t1: 7.85, ct3: 8.2, t3: 8.45, ct2: 8.55 };
const PLANT = 8.5; // the bomb appears next to the planter
const PLANT_HOLD = [PLANT - 0.35, PLANT + 1.1]; // the planter stands still while planting
const POSTER = 10.4; // the moment shown with reduced motion

const pct = (t) => String(Math.round((t / D) * 1000) / 10);
const num = (v) => String(Math.round(v * 100) / 100);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** @keyframes from stops [[seconds, 'css'], ...]; the first and the last stop are added if missing */
function kf(name, stops) {
  const list = [...stops].sort((a, b) => a[0] - b[0]);
  if (list[0][0] > 0) list.unshift([0, list[0][1]]);
  if (list.at(-1)[0] < D) list.push([D, list.at(-1)[1]]);
  let out = `  @keyframes defuze-${name} {\n`;
  list.forEach(([t, css]) => {
    const body = css
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `      ${s};`)
      .join('\n');
    out += `    ${pct(t)}% {\n${body}\n    }\n`;
  });
  return out + '  }\n\n';
}

// ---- The rounds ----
const probs = [0.62, 0.38, 0.7, 0.45, 0.3, 0.58, 0.55, 0.66, 0.41, 0.52];
const winners = ['ct', 't', 'ct', 'ct', 't', 'ct', 't', 'ct', 't', 't'];
const SELECTED = 6;
const TILE_X = 22.5;
const TILE_STEP = 20;
const TILE_Y = 52;
const TILE_H = 56;

// ---- The players of the selected round ----
// path: where the player starts and the stops on the way to the fight; die: when the player is
// killed; planter: the Terrorist who plants the bomb. Everybody who is alive keeps walking in small
// steps around the place they reached (only the planter stands still while planting).
const players = [
  {
    team: 'ct',
    path: [
      [106, 34],
      [150, 46],
      [182, 46],
    ],
    delay: 0,
    die: KILLS.ct0,
  },
  {
    team: 'ct',
    path: [
      [114, 40],
      [142, 58],
      [158, 68],
    ],
    delay: 0.1,
  },
  {
    team: 'ct',
    path: [
      [122, 34],
      [136, 38],
      [196, 42],
    ],
    delay: 0.05,
    die: KILLS.ct2,
  },
  {
    team: 'ct',
    path: [
      [130, 40],
      [160, 52],
      [170, 62],
    ],
    delay: 0.15,
    die: KILLS.ct3,
  },
  {
    team: 'ct',
    path: [
      [110, 42],
      [76, 46],
      [44, 50],
    ],
    delay: 0.2,
  },
  {
    team: 't',
    path: [
      [112, 126],
      [166, 128],
      [186, 52],
    ],
    delay: 0,
    planter: true,
  },
  {
    team: 't',
    path: [
      [120, 132],
      [176, 128],
      [192, 74],
    ],
    delay: 0.1,
    die: KILLS.t1,
  },
  {
    team: 't',
    path: [
      [104, 130],
      [160, 124],
      [166, 74],
    ],
    delay: 0.2,
  },
  {
    team: 't',
    path: [
      [128, 126],
      [180, 126],
      [200, 78],
    ],
    delay: 0.05,
    die: KILLS.t3,
  },
  {
    team: 't',
    path: [
      [134, 132],
      [96, 112],
      [64, 86],
    ],
    delay: 0.15,
  },
];

// A small deterministic random number generator, so that the picture is the same at every build
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let v = Math.imul(s ^ (s >>> 15), 1 | s);
    v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function route(p, index) {
  const random = seeded(7000 + index * 31);
  const pts = [[0, p.path[0]]];
  let t = START + p.delay;
  let cur = p.path[0];
  pts.push([t, cur]);
  for (const next of p.path.slice(1)) {
    t += dist(cur, next) / SPEED;
    pts.push([t, next]);
    cur = next;
  }
  p.arrive = t;
  const end = p.die ?? D;
  // After the run: small steps, one after the other without stopping, in a loop around the place
  // (four steps in random directions and a step that closes the circle)
  const steps = [];
  let sum = [0, 0];
  for (let k = 0; k < 4; k++) {
    const angle = random() * Math.PI * 2;
    const length = 3 + random() * 2.5;
    const step = [Math.cos(angle) * length, Math.sin(angle) * length];
    steps.push(step);
    sum = [sum[0] + step[0], sum[1] + step[1]];
  }
  steps.push([-sum[0], -sum[1]]);
  let k = 0;
  let held = false;
  while (t < end - 1e-6) {
    // The planter stands still while the bomb is planted
    if (p.planter && !held && t >= PLANT_HOLD[0] - 1e-6) {
      held = true;
      pts.push([PLANT_HOLD[0], cur]);
      t = PLANT_HOLD[1];
      pts.push([t, cur]);
      continue;
    }
    const index2 = k % steps.length;
    const step = steps[index2];
    k += 1;
    const next = [cur[0] + step[0], cur[1] + step[1]];
    const dt = dist(cur, next) / WANDER_SPEED;
    // Stop at the moment of the death, in the middle of a step, or before the planter holds still
    let stopAt = end;
    if (p.planter && !held) stopAt = Math.min(stopAt, PLANT_HOLD[0]);
    if (t + dt > stopAt) {
      const f = (stopAt - t) / dt;
      const mid = [cur[0] + step[0] * f, cur[1] + step[1] * f];
      pts.push([stopAt, mid]);
      cur = mid;
      t = stopAt;
      if (stopAt === end) break;
      // The rest of the step is walked after the stop
      k -= 1;
      steps[index2] = [step[0] * (1 - f), step[1] * (1 - f)];
      continue;
    }
    t += dt;
    pts.push([t, next]);
    cur = next;
  }
  p.last = cur;
  return pts;
}
function posAt(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, p1] = pts[i];
    const [t0, p0] = pts[i - 1];
    if (t <= t1) {
      const f = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f];
    }
  }
  return pts.at(-1)[1];
}

let playerFrames = '';
let playerBase = '';
let playerMotion = '';
let bomb = [193, 60];
const routes = players.map((p, i) => route(p, i));
players.forEach((p, i) => {
  const pts = routes[i];
  const times = new Set(pts.map(([t]) => Math.round(t * 1000) / 1000));
  if (p.die !== undefined) {
    times.add(p.die - 0.05);
    times.add(p.die + 0.05);
  }
  const op = (t) => (p.die === undefined ? 1 : t <= p.die - 0.05 ? 1 : t >= p.die + 0.05 ? 0 : 0.5);
  const stops = [...times].map((t) => {
    const [x, y] = posAt(pts, Math.min(t, p.die ?? D));
    return [t, `transform: translate(${num(x)}px, ${num(y)}px); opacity: ${op(t)}`];
  });
  playerFrames += kf(`p${i}`, stops);
  const [px, py] = posAt(pts, Math.min(POSTER, p.die ?? D));
  playerBase += `  .df-p${i} {\n    transform: translate(${num(px)}px, ${num(py)}px);\n    opacity: ${op(POSTER)};\n  }\n\n`;
  playerMotion += `    .df-p${i} {\n      animation: defuze-p${i} ${D}s linear infinite;\n    }\n\n`;
  if (p.planter) {
    // The bomb is put next to the planter, where the planter stands at the plant
    const [bx, by] = posAt(pts, PLANT);
    bomb = [bx + 8, by + 2];
  }
  if (p.die !== undefined) {
    p.cross = posAt(pts, p.die);
    playerFrames += kf(`x${i}`, [
      [p.die - 0.05, 'opacity: 0; transform: scale(0.4)'],
      [p.die + 0.2, 'opacity: 1; transform: scale(1)'],
    ]);
    playerMotion += `    .df-xd${i} {\n      animation: defuze-x${i} ${D}s ease-out infinite;\n    }\n\n`;
  }
});

// ---- Static markup ----
let tiles = '';
probs.forEach((chance, i) => {
  const x = TILE_X + i * TILE_STEP;
  const ct = TILE_H * chance;
  tiles += `      <g class="df-tile df-tile-${i}">
        <rect class="df-t" x="${x}" y="${TILE_Y}" width="15" height="${TILE_H}" rx="2.5" />
        <rect class="df-ct" x="${x}" y="${TILE_Y}" width="15" height="${num(ct)}" rx="2.5" />
        <rect class="df-ct" x="${x}" y="${num(TILE_Y + ct - 3)}" width="15" height="3" />
      </g>\n`;
});
let meta = '';
winners.forEach((w, i) => {
  const x = TILE_X + i * TILE_STEP + 7.5;
  meta += `      <circle class="df-win df-${w}" cx="${x}" cy="119" r="3.2" />
      <text class="df-num" x="${x}" y="134">${i + 1}</text>\n`;
});
let marks = '';
players.forEach((p, i) => {
  if (p.die !== undefined) {
    marks += `      <g transform="translate(${num(p.cross[0])} ${num(p.cross[1])})">
        <path class="df-x df-${p.team} df-xd${i}" d="M-3.2 -3.2l6.4 6.4M3.2 -3.2l-6.4 6.4" />
      </g>\n`;
  }
});
let dots = '';
players.forEach((p, i) => {
  dots += `      <circle class="df-dot df-${p.team} df-p${i}" cx="0" cy="0" r="3.4" />\n`;
});

const tileFrames = probs
  .map((_, i) => {
    const a = 0.5 + i * 0.22;
    return kf(`tile-${i}`, [
      [a, 'opacity: 0; transform: scaleY(0.15)'],
      [a + 0.35, 'opacity: 1; transform: scaleY(1)'],
    ]);
  })
  .join('');
const tileRules = probs
  .map(
    (_, i) =>
      `    .df-tile-${i} {\n      animation: defuze-tile-${i} ${D}s ease-out infinite;\n    }\n\n`,
  )
  .join('');

const frames =
  kf('scene', [
    [0, 'opacity: 0'],
    [0.4, 'opacity: 1'],
    [11.2, 'opacity: 1'],
    [D, 'opacity: 0'],
  ]) +
  kf('strip', [
    [0, 'opacity: 0'],
    [0.5, 'opacity: 1'],
    [4.3, 'opacity: 1'],
    [4.7, 'opacity: 0'],
  ]) +
  kf('meta', [
    [0, 'opacity: 0'],
    [2.7, 'opacity: 0'],
    [3.1, 'opacity: 1'],
  ]) +
  tileFrames +
  kf('select', [
    [0, 'opacity: 0'],
    [3.4, 'opacity: 0'],
    [3.7, 'opacity: 1'],
    [4.3, 'opacity: 1'],
    [4.6, 'opacity: 0'],
  ]) +
  kf('panel', [
    [0, 'opacity: 0; transform: scale(0.09)'],
    [4.1, 'opacity: 0; transform: scale(0.09); animation-timing-function: ease-out'],
    [4.8, 'opacity: 1; transform: scale(1)'],
  ]) +
  playerFrames +
  kf('bomb', [
    [0, 'opacity: 0'],
    [PLANT - 0.05, 'opacity: 0'],
    [PLANT + 0.1, 'opacity: 1'],
  ]) +
  kf('bomb-ring', [
    [0, 'opacity: 0; transform: scale(1)'],
    [PLANT - 0.05, 'opacity: 0; transform: scale(1)'],
    [PLANT + 0.05, 'opacity: 0.9; transform: scale(1)'],
    [PLANT + 0.7, 'opacity: 0; transform: scale(3)'],
    [PLANT + 0.75, 'opacity: 0.9; transform: scale(1)'],
    [PLANT + 1.4, 'opacity: 0; transform: scale(3)'],
    [PLANT + 1.45, 'opacity: 0.9; transform: scale(1)'],
    [PLANT + 2.1, 'opacity: 0; transform: scale(3)'],
  ]) +
  kf('bar', [
    [0, 'transform: scaleX(0.55)'],
    [PLANT, 'transform: scaleX(0.55)'],
    [PLANT + 0.6, 'transform: scaleX(0.22)'],
  ]) +
  kf('flash', [
    [0, 'opacity: 0'],
    [PLANT, 'opacity: 0'],
    [PLANT + 0.2, 'opacity: 0.35'],
    [PLANT + 0.9, 'opacity: 0'],
  ]) +
  kf('cap-1', [
    [0, 'opacity: 0'],
    [0.9, 'opacity: 0'],
    [1.2, 'opacity: 0.85'],
    [4.1, 'opacity: 0.85'],
    [4.4, 'opacity: 0'],
  ]) +
  kf('cap-2', [
    [0, 'opacity: 0'],
    [5.0, 'opacity: 0'],
    [5.3, 'opacity: 0.9'],
    [PLANT - 0.3, 'opacity: 0.9'],
    [PLANT - 0.05, 'opacity: 0'],
  ]) +
  kf('cap-3', [
    [0, 'opacity: 0'],
    [PLANT + 0.1, 'opacity: 0'],
    [PLANT + 0.4, 'opacity: 0.95'],
  ]);

const motion = `    .df-scene {
      animation: defuze-scene ${D}s linear infinite;
    }

    .df-strip {
      animation: defuze-strip ${D}s linear infinite;
    }

    .df-meta {
      animation: defuze-meta ${D}s linear infinite;
    }

${tileRules}    .df-select {
      animation: defuze-select ${D}s linear infinite;
    }

    .df-panel {
      animation: defuze-panel ${D}s linear infinite;
    }

${playerMotion}    .df-bomb-core {
      animation: defuze-bomb ${D}s linear infinite;
    }

    .df-bomb-ring {
      animation: defuze-bomb-ring ${D}s ease-out infinite;
    }

    .df-bar-ct {
      animation: defuze-bar ${D}s ease-in-out infinite;
    }

    .df-bar-flash {
      animation: defuze-flash ${D}s linear infinite;
    }

    .df-cap-1 {
      animation: defuze-cap-1 ${D}s linear infinite;
    }

    .df-cap-2 {
      animation: defuze-cap-2 ${D}s linear infinite;
    }

    .df-cap-3 {
      animation: defuze-cap-3 ${D}s linear infinite;
    }
`;

const killList = Object.entries(KILLS)
  .map(([who, at]) => `${who} ${at}`)
  .join(', ');
const file = `---
// Made by scripts/generate-defuze-picture.mjs (change the script, not this file).
//
// The project Defuze in twelve seconds, in two parts. First a timeline of rounds: every round has a
// bar that shows how likely the Counter-Terrorists (blue) or the Terrorists (amber) were to win it,
// as the model predicted at the start of the round, and a dot for the team that really won it.
// Then the picture zooms into one round and shows the replay from above: the players run over a
// stylized map at the same speed and then keep moving in small steps (only the planter stands still
// while planting, and the dead do not move). The teams meet at site A and kill each other (the
// dead turn into a cross in their color; some kills happen at almost the same time, some a little
// later), a Terrorist plants the bomb, which appears next to that player, and the prediction is made
// again: as in the project, it is made twice, at the start of the round and at the bomb plant, and
// the bar at the bottom changes at the second moment.
//
// Pure CSS and SVG. All pictures of the project cards use the same coordinates (240 by 200) and
// the same label size, so that text looks the same size in every card. The base style of every part
// is the frame that tells the story (used with reduced motion, and before the animation starts:
// the bomb is planted, the dead are crosses and the prediction has changed); the keyframes build
// the scene up and the whole scene fades out at the end of the loop. The numbers come from a
// script that worked out the times from the paths, the speeds and the events (kills: ${killList}
// seconds; the plant at ${PLANT} seconds).
---

<svg
  viewBox="0 0 240 200"
  class="defuze block h-full w-full"
  preserveAspectRatio="xMidYMid meet"
  focusable="false"
>
  <g class="df-scene">
    <text class="df-title" x="5" y="10">CS2 Demo Replay</text>

    <!-- Part 1: the rounds, each with the predicted chance of the two teams and the real winner -->
    <g class="df-strip">
      <path class="df-half" d="M20 80H219" />
      <text class="df-half-label" x="221" y="83">50%</text>
${tiles}      <rect
        class="df-select"
        x="${TILE_X + SELECTED * TILE_STEP - 3}"
        y="${TILE_Y - 3}"
        width="21"
        height="${TILE_H + 6}"
        rx="4"></rect>
      <g class="df-meta">
${meta}        <text class="df-legend" x="120" y="160">Bars: Prediction · Dots: Winner</text>
      </g>
    </g>

    <!-- Part 2: the picture zooms into the selected round: the replay from above -->
    <g class="df-panel">
      <rect class="df-map" x="12" y="22" width="216" height="128" rx="8"></rect>
      <rect class="df-wall" x="96" y="62" width="44" height="24" rx="3"></rect>
      <rect class="df-wall" x="40" y="86" width="34" height="20" rx="3"></rect>
      <rect class="df-wall" x="46" y="120" width="26" height="18" rx="3"></rect>
      <rect class="df-wall" x="146" y="96" width="22" height="16" rx="3"></rect>
      <rect class="df-wall" x="60" y="36" width="26" height="16" rx="3"></rect>
      <rect class="df-spawn df-spawn-ct" x="98" y="28" width="40" height="18" rx="5"></rect>
      <rect class="df-spawn df-spawn-t" x="98" y="120" width="40" height="24" rx="5"></rect>
      <rect class="df-site" x="176" y="34" width="30" height="30" rx="6"></rect>
      <rect class="df-site" x="22" y="34" width="30" height="30" rx="6"></rect>
      <text class="df-site-label" x="191" y="53">A</text>
      <text class="df-site-label" x="37" y="53">B</text>

      <!-- The bomb, next to the Terrorist who plants it at site A -->
      <g class="df-bomb">
        <circle class="df-bomb-ring" cx="${num(bomb[0])}" cy="${num(bomb[1])}" r="4"></circle>
        <rect class="df-bomb-core" x="${num(bomb[0] - 3)}" y="${num(bomb[1] - 3)}" width="6" height="6" rx="1.5"></rect>
      </g>

      <!-- The dead: a cross in the color of their team where they fell -->
${marks}
      <!-- The players: 5 Counter-Terrorists (blue) and 5 Terrorists (amber) -->
${dots}
      <!-- The prediction: the share of the blue team is the filled part. It is made at the start of
           the round (55 per cent) and again at the bomb plant (22 per cent). -->
      <rect class="df-bar-t" x="12" y="158" width="216" height="7" rx="3.5"></rect>
      <rect class="df-bar-ct" x="12" y="158" width="216" height="7" rx="3.5"></rect>
      <rect class="df-bar-flash" x="12" y="158" width="216" height="7" rx="3.5"></rect>
      <text class="df-side df-side-ct" x="12" y="178">CT</text>
      <text class="df-side df-side-t" x="228" y="178">T</text>
    </g>

    <!-- What is happening, in three phases -->
    <text class="df-cap df-cap-1" x="120" y="194">Round Win Probability</text>
    <text class="df-cap df-cap-2" x="120" y="194">Prediction at Round Start</text>
    <text class="df-cap df-cap-3" x="120" y="194">Updated at Bomb Plant</text>
  </g>
</svg>

<style>
  /* Colors come from the tokens of the site: blue for the Counter-Terrorists, amber for the
     Terrorists */
  .df-title {
    fill: var(--color-accent-2);
    font-family: var(--font-mono), monospace;
    font-size: 8.5px;
    letter-spacing: 0.02em;
    opacity: 0.8;
  }

  .df-ct {
    fill: var(--color-accent);
  }

  .df-t {
    fill: var(--color-contrast);
  }

  .df-tile {
    transform-box: fill-box;
    transform-origin: 50% 100%;
  }

  .df-half {
    stroke: var(--color-muted);
    stroke-width: 0.8;
    stroke-dasharray: 2 3;
    opacity: 0.5;
  }

  .df-half-label,
  .df-num,
  .df-legend {
    fill: var(--color-muted);
    font-family: var(--font-mono), monospace;
    font-size: 8.5px;
    opacity: 0.7;
  }

  .df-num {
    text-anchor: middle;
  }

  .df-legend {
    text-anchor: middle;
  }

  .df-select {
    fill: none;
    stroke: var(--color-accent-2);
    stroke-width: 1.4;
    opacity: 0;
  }

  .df-map {
    fill: color-mix(in srgb, var(--color-surface) 70%, transparent);
    stroke: var(--color-border);
    stroke-width: 1.2;
  }

  .df-wall {
    fill: var(--color-border);
    opacity: 0.85;
  }

  .df-spawn {
    stroke-width: 1;
    stroke-dasharray: 2.5 2.5;
  }

  .df-spawn-ct {
    fill: color-mix(in srgb, var(--color-accent) 8%, transparent);
    stroke: color-mix(in srgb, var(--color-accent) 45%, transparent);
  }

  .df-spawn-t {
    fill: color-mix(in srgb, var(--color-contrast) 8%, transparent);
    stroke: color-mix(in srgb, var(--color-contrast) 45%, transparent);
  }

  .df-site {
    fill: color-mix(in srgb, var(--color-accent-2) 8%, transparent);
    stroke: var(--color-accent-2);
    stroke-width: 1.2;
    stroke-dasharray: 3 2.5;
  }

  .df-site-label {
    fill: var(--color-accent-2);
    font-family: var(--font-mono), monospace;
    font-size: 8.5px;
    text-anchor: middle;
    opacity: 0.8;
  }

  .df-bomb-core {
    fill: var(--color-danger);
  }

  .df-bomb-ring {
    fill: none;
    stroke: var(--color-danger);
    stroke-width: 1.2;
    transform-box: fill-box;
    transform-origin: center;
    opacity: 0.6;
  }

  /* A cross for a dead player, in the color of the team */
  .df-x {
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
  }

  .df-x.df-ct {
    stroke: var(--color-accent);
  }

  .df-x.df-t {
    stroke: var(--color-contrast);
  }

  .df-xd0,
  .df-xd1,
  .df-xd2,
  .df-xd3,
  .df-xd4,
  .df-xd5,
  .df-xd6,
  .df-xd7,
  .df-xd8,
  .df-xd9 {
    transform-box: fill-box;
    transform-origin: center;
  }

  .df-win {
    stroke: none;
  }

  /* The frame that tells the story: the bomb is planted, the dead are crosses, the survivors stand
     where they are after the plant */
  .df-dot {
    stroke: var(--color-bg);
    stroke-width: 0.8;
  }

${playerBase}  .df-bar-t {
    fill: var(--color-contrast);
  }

  .df-bar-ct {
    fill: var(--color-accent);
    transform-box: fill-box;
    transform-origin: 0% 50%;
    transform: scaleX(0.22);
  }

  .df-bar-flash {
    fill: var(--color-fg);
    opacity: 0;
  }

  .df-side {
    font-family: var(--font-mono), monospace;
    font-size: 8.5px;
    letter-spacing: 0.02em;
    opacity: 0.85;
  }

  .df-side-ct {
    fill: var(--color-accent);
  }

  .df-side-t {
    fill: var(--color-contrast);
    text-anchor: end;
  }

  .df-cap {
    font-family: var(--font-mono), monospace;
    font-size: 8.5px;
    letter-spacing: 0.02em;
    text-anchor: middle;
    opacity: 0;
  }

  .df-cap-1,
  .df-cap-2 {
    fill: var(--color-muted);
  }

  .df-cap-3 {
    fill: var(--color-contrast);
    opacity: 0.95;
  }

  /* The rounds are not part of the still frame */
  .df-strip {
    opacity: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .df-panel {
      transform-origin: ${TILE_X + SELECTED * TILE_STEP + 7.5}px 80px;
    }

${motion}  }

${frames}</style>
`;
const target = resolve('src/components/project-art/Defuze.astro');
const options = await resolveConfig(target);
const made = await format(file.replace(/\n{3,}/g, '\n\n'), { ...options, filepath: target });
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== made) {
    console.error(
      'Defuze.astro is not what scripts/generate-defuze-picture.mjs makes. Run the script and commit the result.',
    );
    process.exit(1);
  }
} else {
  writeFileSync(target, made);
}
console.warn(
  'arrivals',
  players.map((p) => num(p.arrive)).join(' '),
  '| bomb',
  num(bomb[0]),
  num(bomb[1]),
  '| crosses',
  players.map((p) => (p.cross ? num(p.cross[0]) + ',' + num(p.cross[1]) : '-')).join(' '),
);
