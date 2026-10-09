import type { Page } from '@playwright/test';

import type { Game } from '../../src/game/Game';

declare global {
  interface Window {
    __crownstack?: Game;
  }
}

const YAW = Math.PI / 4;
const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;

export interface Snapshot {
  x: number;
  y: number;
  gold: number;
  outcome: string;
  time: number;
  enemies: number;
  towers: number;
}

/** Reads a few facts about the running game through the `?debug=1` hook. */
export function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const w = window.__crownstack!.currentWorld;
    return {
      x: w.x[w.hero],
      y: w.y[w.hero],
      gold: w.eco.stackCoins * w.cfg.units.economy.coinValue + w.eco.bank,
      outcome: w.outcome,
      time: w.time,
      enemies: w.enemiesAlive,
      towers: w.plots.filter((p) => p.tier > 0).length,
    };
  });
}

async function setKeys(page: Page, held: Set<string>, want: Set<string>): Promise<void> {
  for (const key of KEYS) {
    if (want.has(key) && !held.has(key)) await page.keyboard.down(key);
    if (!want.has(key) && held.has(key)) await page.keyboard.up(key);
  }
  held.clear();
  for (const key of want) held.add(key);
}

/** Steers the king to a world position with real key presses, like a player would. */
export async function walkTo(page: Page, x: number, y: number, tolerance = 0.6): Promise<void> {
  const held = new Set<string>();
  const deadline = Date.now() + 60_000;
  try {
    while (Date.now() < deadline) {
      const s = await snapshot(page);
      const dx = x - s.x;
      const dy = y - s.y;
      if (Math.hypot(dx, dy) < tolerance) return;
      // World delta -> screen axes (see game/input/index.ts).
      const sx = dx * Math.cos(YAW) - dy * Math.sin(YAW);
      const sy = dx * Math.sin(YAW) + dy * Math.cos(YAW);
      const want = new Set<string>();
      if (Math.abs(sx) > 0.25) want.add(sx > 0 ? 'KeyD' : 'KeyA');
      if (Math.abs(sy) > 0.25) want.add(sy > 0 ? 'KeyS' : 'KeyW');
      await setKeys(page, held, want);
      await page.waitForTimeout(30);
    }
    throw new Error(`walkTo(${x}, ${y}) timed out`);
  } finally {
    await setKeys(page, held, new Set());
  }
}

export async function startLevelOne(page: Page): Promise<void> {
  // Low quality keeps software-rendered CI browsers at a playable frame rate.
  await page.goto('/?debug=1&quality=low');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(() => window.__crownstack?.currentWorld.tick !== undefined);
}

/** Smoothed frame rate reported by the game. */
export function fps(page: Page): Promise<number> {
  return page.evaluate(() => window.__crownstack!.perf.fps);
}
