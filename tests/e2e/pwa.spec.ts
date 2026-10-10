import { expect, test } from '@playwright/test';

import { snapshot, walkToPad } from './helpers';

test('plays level 1 offline after the first load', async ({ page, context }) => {
  await page.goto('/?debug=1&quality=low');
  // First visit installs the service worker and fills the precache...
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active!;
    if (worker.state !== 'activated') {
      await new Promise<void>((resolve) =>
        worker.addEventListener('statechange', () => worker.state === 'activated' && resolve()),
      );
    }
  });
  // ...and the next navigation is served by it.
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Crownstack' })).toBeVisible();

  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /^Level 1:/ }).click();
  await walkToPad(page, 'tower-ne');
  await expect.poll(async () => (await snapshot(page)).towers, { timeout: 30_000 }).toBe(1);
});

test('menus work from the keyboard alone', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  await expect(page.getByRole('button', { name: 'Play' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Level 1:/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  // A key has been used, so the keyboard hints are showing.
  await expect(page.getByText(/WASD/)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Quit' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose a level' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Crownstack' })).toBeVisible();
});

test('resuming counts down before play continues', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /^Level 1:/ }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  const frozen = (await snapshot(page)).time;

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('status').filter({ hasText: /^[123]$/ })).toBeVisible();
  expect((await snapshot(page)).time).toBe(frozen);
  await expect
    .poll(async () => (await snapshot(page)).time, { timeout: 10_000 })
    .toBeGreaterThan(frozen);
});

test('never asks the player to rotate the device', async ({ page }) => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/?quality=low');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByText(/rotate/i)).toHaveCount(0);
  }
});
