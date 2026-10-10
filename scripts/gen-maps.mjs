// Generates src/content/maps/*.json. The JSON files are what the game loads and
// are committed; this script only keeps their coordinates consistent.
//
// Coordinates are world units, x east and y south. The camera looks north-west
// (yaw 45°), so on screen west is top-left and north is top-right.
//   pnpm maps
import { writeFileSync } from 'node:fs';

const SEG = 3;

/** Fence segments around a rectangle. `skip` lists ids to leave out (hero gaps and gates). */
function fenceRect(x0, y0, x1, y1, { prefix = '', sides = 'nsew', skip = [] } = {}) {
  const out = [];
  const add = (id, a, b) => {
    if (!skip.includes(id)) out.push({ id, a, b });
  };
  for (let i = 0; i < (x1 - x0) / SEG; i++) {
    if (sides.includes('n')) add(`${prefix}n${i}`, [x0 + i * SEG, y0], [x0 + (i + 1) * SEG, y0]);
    if (sides.includes('s')) add(`${prefix}s${i}`, [x0 + i * SEG, y1], [x0 + (i + 1) * SEG, y1]);
  }
  for (let i = 0; i < (y1 - y0) / SEG; i++) {
    if (sides.includes('w')) add(`${prefix}w${i}`, [x0, y0 + i * SEG], [x0, y0 + (i + 1) * SEG]);
    if (sides.includes('e')) add(`${prefix}e${i}`, [x1, y0 + i * SEG], [x1, y0 + (i + 1) * SEG]);
  }
  return out;
}

/** Deterministic scenery: points on the map that avoid yards, paths and walls. */
function scatter(seed, count, map, yards, margin) {
  let s = seed;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const inRect = (x, y, r, pad) =>
    x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
  const nearPath = (x, y) =>
    map.paths.some((p) =>
      p.points.some(([ax, ay], i) => {
        const [bx, by] = p.points[Math.min(i + 1, p.points.length - 1)];
        const t = Math.max(
          0,
          Math.min(
            1,
            ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1),
          ),
        );
        return Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) < 3.2;
      }),
    );
  const out = [];
  for (let tries = 0; out.length < count && tries < 4000; tries++) {
    const x = Math.round((1 + rand() * (map.size.w - 2)) * 2) / 2;
    const y = Math.round((1 + rand() * (map.size.h - 2)) * 2) / 2;
    if (yards.some((r) => inRect(x, y, r, margin))) continue;
    if (map.blockers.walls.some((r) => inRect(x, y, r, 1.2))) continue;
    if (nearPath(x, y)) continue;
    if (out.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < 3)) continue;
    out.push([x, y]);
  }
  return out;
}

function finish(map, yards, { trees, rocks, seed }) {
  const points = scatter(seed, trees + rocks, map, yards, 2.5);
  map.blockers.trees = points.slice(0, trees);
  map.blockers.rocks = points.slice(trees).map((pos, i) => ({ pos, r: 0.7 + (i % 3) * 0.15 }));
  writeFileSync(`src/content/maps/${map.id}.json`, `${JSON.stringify(map, null, 2)}\n`);
  console.log(
    `${map.id}: ${map.blockers.fences.length} fences, ${map.plots.length} plots, ${map.pads.length} pads`,
  );
}

const towerPad = (plot, pos) => ({ id: `tower-${plot}`, type: 'tower', plot, pos });

// ── Yard A: the ad's camp ────────────────────────────────────────────────────
{
  const yard = { x: 10, y: 10, w: 24, h: 18 };
  finish(
    {
      id: 'yard-a',
      name: 'Yard A',
      size: { w: 46, h: 38 },
      cameraBounds: { x: 7, y: 2, w: 33, h: 29 },
      ground: { base: 'grass', patches: [{ type: 'dirt', ...yard }] },
      blockers: {
        fences: fenceRect(10, 10, 34, 28, { skip: ['n6'] }), // n6 is the king's gate
        gates: [],
        walls: [],
        buildings: [
          { type: 'forge', pos: [28.5, 24.5] },
          { type: 'archery', pos: [13, 13.5] },
        ],
      },
      plots: [
        { id: 'nw', pos: [11.6, 11.6] },
        { id: 'ne', pos: [32.4, 11.6] },
        { id: 'sw', pos: [11.6, 26.4] },
        { id: 'se', pos: [32.4, 26.4] },
      ],
      pads: [
        towerPad('nw', [14.5, 11.8]),
        towerPad('ne', [29.6, 14]),
        towerPad('sw', [14, 26.2]),
        towerPad('se', [30.4, 23.2]),
        { id: 'forge', type: 'forge', pos: [25.5, 24.5] },
        { id: 'repair', type: 'repair', pos: [29.5, 17.8] },
        { id: 'keep', type: 'keep', pos: [18.5, 22.5] },
      ],
      paths: [
        {
          id: 'ne',
          targetFence: 'e3',
          points: [
            [31, -1],
            [31.5, 3],
            [34.5, 6.5],
            [37.5, 10],
            [38, 15],
            [36.5, 19],
            [34.9, 20.5],
            [32, 20.5],
            [24, 19.5],
            [16.6, 18.5],
          ],
        },
        {
          id: 'e',
          targetFence: 'e5',
          points: [
            [47, 23],
            [43, 23.5],
            [39, 24.5],
            [36.5, 25.5],
            [34.9, 25.5],
            [32.6, 25],
            [31.2, 21.6],
            [23, 19.8],
            [16.6, 19.2],
          ],
        },
      ],
      heroStart: [22, 16],
      keep: { x: 11.5, y: 16, w: 4, h: 5 },
    },
    [yard],
    { trees: 18, rocks: 6, seed: 11 },
  );
}

// ── Ridge B: cliffs with a narrow pass ───────────────────────────────────────
{
  const yard = { x: 13, y: 18, w: 24, h: 15 };
  const cliffs = [
    { x: 0, y: 4, w: 22.5, h: 8 },
    { x: 27.5, y: 4, w: 22.5, h: 8 },
  ];
  finish(
    {
      id: 'ridge-b',
      name: 'Ridge B',
      size: { w: 50, h: 40 },
      cameraBounds: { x: 6, y: 1, w: 38, h: 35 },
      ground: {
        base: 'grass',
        patches: [{ type: 'dirt', ...yard }, ...cliffs.map((c) => ({ type: 'cliff', ...c }))],
      },
      blockers: {
        fences: fenceRect(13, 18, 37, 33, { skip: ['n6'] }),
        gates: [],
        walls: cliffs,
        buildings: [
          { type: 'forge', pos: [32.5, 26.5] },
          { type: 'archery', pos: [17.5, 29.6] },
        ],
      },
      plots: [
        { id: 'nw', pos: [14.6, 19.6] },
        { id: 'ne', pos: [35.4, 19.6] },
        { id: 'sw', pos: [14.6, 31.4] },
        { id: 'se', pos: [35.4, 31.4] },
        { id: 'n', pos: [23.4, 19.6] },
        { id: 'w', pos: [14.6, 23] },
      ],
      pads: [
        towerPad('nw', [17.4, 20.6]),
        towerPad('ne', [33, 21.6]),
        towerPad('sw', [17, 32]),
        towerPad('se', [33, 30.8]),
        towerPad('n', [21.6, 22.2]),
        towerPad('w', [18, 23.2]),
        { id: 'forge', type: 'forge', pos: [29.6, 26.2] },
        { id: 'repair', type: 'repair', pos: [29.8, 22.6] },
        { id: 'keep', type: 'keep', pos: [29.8, 30.2] },
      ],
      paths: [
        {
          id: 'n',
          targetFence: 'n4',
          points: [
            [25, -1],
            [25, 5],
            [25.3, 11],
            [26.2, 15],
            [26.5, 18],
            [26.3, 22],
            [25, 25.8],
          ],
        },
        {
          id: 'w',
          targetFence: 'w2',
          points: [
            [-1, 25],
            [4, 24.5],
            [9, 25.5],
            [13, 25.5],
            [16, 25.5],
            [20, 27],
            [21.8, 28.6],
          ],
        },
      ],
      heroStart: [28.4, 23.8],
      keep: { x: 23, y: 27, w: 4, h: 4.5 },
    },
    [yard],
    { trees: 22, rocks: 8, seed: 23 },
  );
}

// ── River C: an outpost, a bridge chokepoint and the keep's yard ─────────────
{
  const westYard = { x: 8, y: 11, w: 15, h: 18 };
  const outpost = { x: 33, y: 11, w: 15, h: 18 };
  const river = [
    { x: 26, y: 0, w: 4, h: 17.5 },
    { x: 26, y: 22.5, w: 4, h: 17.5 },
  ];
  finish(
    {
      id: 'river-c',
      name: 'River C',
      size: { w: 56, h: 40 },
      cameraBounds: { x: 4, y: 5, w: 48, h: 30 },
      ground: {
        base: 'grass',
        patches: [
          { type: 'dirt', ...westYard },
          { type: 'dirt', ...outpost },
          { type: 'water', x: 26, y: -20, w: 4, h: 80 },
          { type: 'wood', x: 25.6, y: 17.5, w: 4.8, h: 5 },
        ],
      },
      blockers: {
        fences: [
          // The keep's yard opens onto the bridge (no e2/e3).
          ...fenceRect(8, 11, 23, 29, { skip: ['e2', 'e3'] }),
          // The outpost has no west side: it faces the bridge.
          ...fenceRect(33, 11, 48, 29, { prefix: 'o', sides: 'nse' }),
        ],
        gates: [{ id: 'bridge', a: [28, 17.5], b: [28, 22.5] }],
        walls: river,
        buildings: [
          { type: 'forge', pos: [44, 15.5] },
          { type: 'archery', pos: [17, 13.6] },
          { type: 'brazier', pos: [19.6, 26.4] },
        ],
      },
      plots: [
        { id: 'w-n', pos: [21.4, 15.2] },
        { id: 'w-s', pos: [21.4, 24.8] },
        { id: 'k-n', pos: [9.6, 12.6] },
        { id: 'k-s', pos: [9.6, 27.4] },
        { id: 'o-nw', pos: [34.6, 12.6] },
        { id: 'o-sw', pos: [34.6, 27.4] },
        { id: 'o-ne', pos: [46.4, 12.6] },
        { id: 'o-se', pos: [46.4, 27.4] },
      ],
      pads: [
        towerPad('w-n', [19, 16.4]),
        towerPad('w-s', [18.6, 23.6]),
        towerPad('k-n', [12.4, 13.6]),
        towerPad('k-s', [12.4, 26.4]),
        towerPad('o-nw', [36.4, 15.2]),
        towerPad('o-sw', [36.4, 24.8]),
        towerPad('o-ne', [44.6, 12.8]),
        towerPad('o-se', [44, 25.6]),
        { id: 'forge', type: 'forge', pos: [41.2, 16.4] },
        { id: 'repair', type: 'repair', pos: [44.4, 22.8] },
        { id: 'keep', type: 'keep', pos: [15.6, 23.4] },
        { id: 'gate', type: 'gate', pos: [21.2, 21.8] },
        { id: 'brazier', type: 'brazier', pos: [16.6, 26.4] },
      ],
      paths: [
        {
          id: 's',
          targetFence: 'os2',
          points: [
            [40.5, 41],
            [40.5, 35],
            [40.5, 30],
            [40.5, 28.6],
            [40, 26],
            [36, 21.5],
            [31, 20],
            [28, 20],
            [24, 20],
            [18, 20],
            [14.6, 20],
          ],
        },
        {
          id: 'e',
          targetFence: 'oe3',
          points: [
            [57, 20],
            [52, 20.6],
            [49, 20.6],
            [47.6, 20.6],
            [44, 20.5],
            [36, 20.3],
            [31, 20],
            [28, 20],
            [24, 20],
            [18, 20.4],
            [14.6, 20.4],
          ],
        },
        {
          id: 'n',
          targetFence: 'on2',
          points: [
            [40.5, -1],
            [40.5, 6],
            [40.5, 10],
            [40.5, 11.4],
            [40, 14],
            [36, 18.5],
            [31, 20],
            [28, 20],
            [24, 20],
            [18, 19.6],
            [14.6, 19.6],
          ],
        },
      ],
      heroStart: [18, 17.4],
      keep: { x: 9.5, y: 17.5, w: 4, h: 5 },
    },
    [westYard, outpost],
    { trees: 24, rocks: 8, seed: 37 },
  );
}

// ── Fortress D: four gates, four plots per side ──────────────────────────────
{
  const fort = { x: 16, y: 16, w: 27, h: 27 };
  const inset = 1.6;
  const along = [19.4, 24.6, 34.4, 39.6];
  const plots = [];
  const pads = [];
  along.forEach((t, i) => {
    plots.push(
      { id: `n${i + 1}`, pos: [t, 16 + inset] },
      { id: `s${i + 1}`, pos: [t, 43 - inset] },
    );
    plots.push(
      { id: `w${i + 1}`, pos: [16 + inset, t] },
      { id: `e${i + 1}`, pos: [43 - inset, t] },
    );
    pads.push(towerPad(`n${i + 1}`, [t, 20.4]), towerPad(`s${i + 1}`, [t, 38.6]));
    pads.push(
      towerPad(`w${i + 1}`, [20.4, t + (t < 29.5 ? 2.6 : -2.6)]),
      towerPad(`e${i + 1}`, [38.6, t + (t < 29.5 ? 2.6 : -2.6)]),
    );
  });
  finish(
    {
      id: 'fortress-d',
      name: 'Fortress D',
      size: { w: 59, h: 59 },
      cameraBounds: { x: 8, y: 8, w: 43, h: 43 },
      ground: { base: 'grass', patches: [{ type: 'dirt', ...fort }] },
      blockers: {
        // The middle segment of each wall (index 4) is a gate.
        fences: fenceRect(16, 16, 43, 43, { skip: ['n4', 's4', 'w4', 'e4'] }),
        gates: [
          { id: 'gn', a: [28, 16], b: [31, 16] },
          { id: 'gs', a: [28, 43], b: [31, 43] },
          { id: 'gw', a: [16, 28], b: [16, 31] },
          { id: 'ge', a: [43, 28], b: [43, 31] },
        ],
        walls: [],
        buildings: [
          { type: 'forge', pos: [23.4, 24.2] },
          { type: 'archery', pos: [35.6, 24.2] },
          { type: 'brazier', pos: [35.4, 35.4] },
        ],
      },
      plots,
      pads: [
        ...pads,
        { id: 'forge', type: 'forge', pos: [25.4, 26.8] },
        { id: 'repair', type: 'repair', pos: [33.4, 26.6] },
        { id: 'keep', type: 'keep', pos: [25.6, 33] },
        { id: 'gate', type: 'gate', pos: [33.4, 32.6] },
        { id: 'brazier', type: 'brazier', pos: [33.2, 35.6] },
      ],
      paths: [
        {
          id: 'n',
          targetFence: 'gn',
          points: [
            [29.5, -1],
            [28, 6],
            [31, 11],
            [29.5, 16],
            [29.5, 20],
            [29.5, 26.2],
          ],
        },
        {
          id: 's',
          targetFence: 'gs',
          points: [
            [29.5, 60],
            [31, 53],
            [28, 48],
            [29.5, 43],
            [29.5, 39],
            [29.5, 32.8],
          ],
        },
        {
          id: 'w',
          targetFence: 'gw',
          points: [
            [-1, 29.5],
            [6, 31],
            [11, 28],
            [16, 29.5],
            [20, 29.5],
            [26.2, 29.5],
          ],
        },
        {
          id: 'e',
          targetFence: 'ge',
          points: [
            [60, 29.5],
            [53, 28],
            [48, 31],
            [43, 29.5],
            [39, 29.5],
            [32.8, 29.5],
          ],
        },
      ],
      heroStart: [32.6, 24.4],
      keep: { x: 27.5, y: 27.5, w: 4, h: 4 },
    },
    [fort],
    { trees: 30, rocks: 8, seed: 53 },
  );
}
