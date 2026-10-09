import { expect, test } from '@playwright/test';

import { snapshot, startLevelOne, walkTo } from './helpers';

test('collects coins and pays the tower pad', async ({ page }) => {
  await startLevelOne(page);
  const gold = page.getByTestId('hud-gold');
  await expect(gold).toHaveText('60');

  // Walk over the loose coins east of the start, then onto the tower pad.
  await walkTo(page, 25, 15);
  await expect.poll(async () => (await snapshot(page)).gold).toBeGreaterThan(60);

  await walkTo(page, 30, 13.6);
  await expect.poll(async () => (await snapshot(page)).towers, { timeout: 15_000 }).toBe(1);
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
