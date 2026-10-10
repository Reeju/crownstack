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

/**
 * Steers the king to a world position through the keyboard, like a player
 * would, and resolves once he is at rest within `tolerance` of it.
 *
 * The steering loop runs inside the page, once per animation frame, and
 * dispatches key events there: a loop on the test side overshoots whenever the
 * machine is busy, because every key release arrives a few frames late.
 */
export async function walkTo(page: Page, x: number, y: number, tolerance = 0.6): Promise<void> {
  await page.evaluate(
    ({ x, y, tolerance, yaw, keys, timeoutMs }) =>
      new Promise<void>((resolve, reject) => {
        const held = new Set<string>();
        const press = (want: Set<string>): void => {
          for (const code of keys) {
            // Wanted keys repeat every frame, like auto-repeat; the game drops held keys on blur.
            if (want.has(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
            else if (held.has(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
          }
          held.clear();
          want.forEach((code) => held.add(code));
        };
        const deadline = performance.now() + timeoutMs;
        let restFrames = 0;

        const frame = (): void => {
          const w = window.__crownstack!.currentWorld;
          const dx = x - w.x[w.hero];
          const dy = y - w.y[w.hero];
          const want = new Set<string>();
          if (Math.hypot(dx, dy) < tolerance) {
            // Inside the target: let go, then confirm he has stopped there.
            if (++restFrames > 6) {
              press(want);
              return resolve();
            }
          } else {
            restFrames = 0;
            // World delta -> screen axes (see game/input/index.ts).
            const sx = dx * Math.cos(yaw) - dy * Math.sin(yaw);
            const sy = dx * Math.sin(yaw) + dy * Math.cos(yaw);
            if (Math.abs(sx) > 0.2) want.add(sx > 0 ? 'KeyD' : 'KeyA');
            if (Math.abs(sy) > 0.2) want.add(sy > 0 ? 'KeyS' : 'KeyW');
          }
          press(want);
          if (w.outcome !== 'playing' || performance.now() > deadline) {
            press(new Set());
            return reject(new Error(`walkTo(${x}, ${y}) did not arrive (outcome: ${w.outcome})`));
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    { x, y, tolerance, yaw: YAW, keys: [...KEYS], timeoutMs: 60_000 },
  );
}

export async function startLevelOne(page: Page): Promise<void> {
  // Low quality keeps software-rendered CI browsers at a playable frame rate.
  await page.goto('/?debug=1&quality=low');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /^Level 1:/ }).click();
  await page.getByRole('button', { name: 'Pause' }).waitFor();
  await page.waitForFunction(() => window.__crownstack?.currentWorld.tick !== undefined);
}

/** Smoothed frame rate reported by the game. */
export function fps(page: Page): Promise<number> {
  return page.evaluate(() => window.__crownstack!.perf.fps);
}

/** Walks onto a pay pad, looked up by its map id so tests survive layout tuning. */
export async function walkToPad(page: Page, padId: string): Promise<void> {
  const pad = await page.evaluate((id) => {
    const found = window.__crownstack!.currentWorld.pads.find((p) => p.id === id);
    return found ? { x: found.x, y: found.y } : null;
  }, padId);
  if (!pad) throw new Error(`No pad "${padId}" in this level`);
  await walkTo(page, pad.x, pad.y);
}
