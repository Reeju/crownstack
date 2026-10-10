// Dev tool: plays a level with scripted waypoints in headless Chromium and
// saves screenshots. Usage:
//   node scripts/capture.mjs <outDir> <level> "<x,y,holdSec;...>" [shotEverySec] [width] [height]
//   VIDEO=1 records a .webm as well.
// Needs the dev server (pnpm dev --port 5317) or set BASE_URL.
import { mkdirSync } from 'node:fs';

import { chromium } from '@playwright/test';

const [outDir, level = '1', route = '', every = '4', width = '1280', height = '800'] =
  process.argv.slice(2);
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5317';
const YAW = Math.PI / 4;
const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const viewport = { width: Number(width), height: Number(height) };
// VIDEO=1 also records a .webm of the whole run into outDir.
const page = await browser.newPage({
  viewport,
  recordVideo: process.env.VIDEO ? { dir: outDir, size: viewport } : undefined,
});
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()));
await page.goto(`${BASE_URL}/?debug=1`);
await page.waitForFunction(() => window.__crownstack);
await page.evaluate((id) => window.__crownstackStart(Number(id)), level);

const snap = () =>
  page.evaluate(() => {
    const w = window.__crownstack.currentWorld;
    return {
      x: w.x[w.hero],
      y: w.y[w.hero],
      t: w.time,
      outcome: w.outcome,
      enemies: w.enemiesAlive,
      archers: w.archersAlive,
      gold: w.eco.stackCoins * 10 + w.eco.bank,
      kills: w.stats.kills,
      keep: w.hp[w.keep],
      king: w.hp[w.hero],
    };
  });

let shots = 0;
let nextShot = 0;
const held = new Set();
async function setKeys(want) {
  for (const k of KEYS) {
    if (want.has(k) && !held.has(k)) await page.keyboard.down(k);
    if (!want.has(k) && held.has(k)) await page.keyboard.up(k);
  }
  held.clear();
  want.forEach((k) => held.add(k));
}
async function tick() {
  const s = await snap();
  if (s.t >= nextShot) {
    nextShot = s.t + Number(every);
    await page.screenshot({
      path: `${outDir}/shot-${String(shots++).padStart(2, '0')}.jpg`,
      quality: 70,
      type: 'jpeg',
    });
    console.log(JSON.stringify(s));
  }
  return s;
}

const waypoints = route
  .split(';')
  .filter(Boolean)
  .map((p) => p.split(',').map(Number));
for (const [x, y, hold = 0] of waypoints) {
  for (;;) {
    const s = await tick();
    if (s.outcome !== 'playing') break;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.hypot(dx, dy) < 0.5) break;
    const sx = dx * Math.cos(YAW) - dy * Math.sin(YAW);
    const sy = dx * Math.sin(YAW) + dy * Math.cos(YAW);
    const want = new Set();
    if (Math.abs(sx) > 0.25) want.add(sx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(sy) > 0.25) want.add(sy > 0 ? 'KeyS' : 'KeyW');
    await setKeys(want);
    await page.waitForTimeout(30);
  }
  await setKeys(new Set());
  const until = (await snap()).t + hold;
  while ((await tick()).t < until && (await snap()).outcome === 'playing')
    await page.waitForTimeout(100);
}
while ((await tick()).outcome === 'playing') await page.waitForTimeout(200);
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/final.jpg`, quality: 70, type: 'jpeg' });
console.log('FINAL', JSON.stringify(await snap()));
await page.close();
await browser.close();
