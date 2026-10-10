import { expect, test } from '@playwright/test';

import { fps, snapshot, startLevelOne, walkTo, walkToPad } from './helpers';

test('collects coins and pays the tower pad', async ({ page }) => {
  await startLevelOne(page);
  const gold = page.getByTestId('hud-gold');
  await expect(gold).toHaveText('60');

  // Walk over the loose coins east of the start, then onto the tower pad.
  await walkTo(page, 25, 15);
  await expect.poll(async () => (await snapshot(page)).gold).toBeGreaterThan(60);

  await walkToPad(page, 'tower-ne');
  await expect.poll(async () => (await snapshot(page)).towers, { timeout: 30_000 }).toBe(1);
  console.log(`frame rate: ${(await fps(page)).toFixed(1)} fps`);
  expect((await snapshot(page)).gold).toBeLessThan(60);
});

test('pauses and resumes', async ({ page }) => {
  await startLevelOne(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();

  const before = (await snapshot(page)).time;
  await page.waitForTimeout(300);
  expect((await snapshot(page)).time).toBe(before);

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(async () => (await snapshot(page)).time).toBeGreaterThan(before);
});

test('wins level 1 with scripted input', async ({ page }) => {
  test.setTimeout(240_000);
  await startLevelOne(page);

  // Grab the loose coins, build the tower, then hold the middle of the yard.
  await walkTo(page, 25, 15);
  await walkToPad(page, 'tower-ne');
  await expect.poll(async () => (await snapshot(page)).towers, { timeout: 30_000 }).toBe(1);
  await walkTo(page, 27, 18);

  await expect(page.getByRole('heading', { name: 'Camp defended!' })).toBeVisible({
    timeout: 200_000,
  });
  expect((await snapshot(page)).outcome).toBe('won');
  console.log(`frame rate at win: ${(await fps(page)).toFixed(1)} fps`);
  expect(Number(await page.getByTestId('result-score').textContent())).toBeGreaterThan(1000);
  await expect(page.getByRole('img', { name: '3 of 3 crowns' })).toBeVisible();
});

test('falls when the king dies, and Retry replays the same seed', async ({ page }) => {
  await startLevelOne(page);
  const seed = await page.evaluate(() => window.__crownstack!.currentWorld.cfg.seed);
  await page.evaluate(() => {
    const w = window.__crownstack!.currentWorld;
    w.hp[w.hero] = 0;
  });
  await expect(page.getByRole('heading', { name: 'The camp has fallen' })).toBeVisible();

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'The camp has fallen' })).toBeHidden();
  expect(await page.evaluate(() => window.__crownstack!.currentWorld.cfg.seed)).toBe(seed);
  expect((await snapshot(page)).outcome).toBe('playing');
});

test('level 2 shows its tutorial and the forge pad', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => window.__crownstack !== undefined);
  await page.evaluate(() =>
    (window as unknown as { __crownstackStart: (id: number) => void }).__crownstackStart(2),
  );
  await expect(page.getByText('The Forge', { exact: true })).toBeVisible();
  await expect(page.getByText(/Build the tower/)).toBeVisible();
  const pads = await page.evaluate(() =>
    window.__crownstack!.currentWorld.pads.map((p) => `${p.type}:${p.cost}`),
  );
  expect(pads).toEqual(['tower:50', 'forge:80']);
});
