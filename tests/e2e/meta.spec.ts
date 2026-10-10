import { expect, test, type Page } from '@playwright/test';

import { fps, startLevelOne } from './helpers';

/** Ends the current level as a win by retiring every wave (the celebration still plays). */
async function winNow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window.__crownstack!.currentWorld;
    for (const wave of w.waves) wave.done = true;
  });
  await expect(page.getByRole('heading', { name: 'Camp defended!' })).toBeVisible({
    timeout: 30_000,
  });
}

test('winning unlocks the next level and progress survives a reload', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Level 2: locked' })).toBeDisabled();

  await page.getByRole('button', { name: /^Level 1:/ }).click();
  await winNow(page);
  await page.getByRole('button', { name: 'Levels' }).click();
  await expect(
    page.getByRole('button', { name: /^Level 1: First Watch, 3 of 3 crowns/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Level 2: The Forge/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Level 3: locked' })).toBeDisabled();

  await page.reload();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: /^Level 2: The Forge/ })).toBeEnabled();
  await expect(page.getByText('3 / 36 crowns earned')).toBeVisible();
});

test('crowns buy upgrades that change the next run', async ({ page }) => {
  await startLevelOne(page);
  await winNow(page);
  await page.getByRole('button', { name: 'Levels' }).click();

  await page.getByRole('button', { name: /Upgrades/ }).click();
  await expect(page.getByLabel('3 crowns to spend')).toBeVisible();
  const pockets = page.getByRole('listitem').filter({ hasText: 'Deeper Pockets' });
  await pockets.getByRole('button').click();
  await expect(page.getByLabel('1 crowns to spend')).toBeVisible();
  await expect(pockets.getByRole('img', { name: 'Rank 1 of 3' })).toBeVisible();
  // Conscription costs 3: no longer affordable.
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Conscription' }).getByRole('button'),
  ).toBeDisabled();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Level 1:/ }).click();
  await expect
    .poll(() => page.evaluate(() => window.__crownstack!.currentWorld.eco.coinCap))
    .toBe(70);
});

test('difficulty and settings are remembered', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel(/Reduced motion/).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('radio', { name: 'Hard' }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('radio', { name: 'Hard' })).toBeChecked();
  await page.getByRole('button', { name: /^Level 1:/ }).click();
  // Hard: carry cap is 20 lower.
  await expect
    .poll(() => page.evaluate(() => window.__crownstack!.currentWorld.eco.coinCap))
    .toBe(40);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel(/Reduced motion/)).toBeChecked();
});

test('level 10 stays inside the frame and draw-call budgets', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => window.__crownstack !== undefined);
  await page.evaluate(() =>
    (window as unknown as { __crownstackStart: (id: number) => void }).__crownstackStart(10),
  );
  // Let the first wave arrive so enemies, arrows, coins and effects are all on screen.
  await expect
    .poll(() => page.evaluate(() => window.__crownstack!.currentWorld.stats.kills), {
      timeout: 60_000,
    })
    .toBeGreaterThan(3);

  const perf = await page.evaluate(() => ({ ...window.__crownstack!.perf }));
  console.log(
    `level 10: ${(await fps(page)).toFixed(1)} fps, sim ${perf.simMs.toFixed(2)} ms, render ${perf.renderMs.toFixed(2)} ms, ${perf.drawCalls} draw calls`,
  );
  expect(perf.drawCalls).toBeLessThanOrEqual(40);
  // CPU-side frame cost. Frame rate itself depends on the machine's GPU (CI renders in software).
  expect(perf.simMs + perf.renderMs).toBeLessThan(16.6);
});
