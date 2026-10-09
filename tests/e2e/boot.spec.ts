import { expect, test } from '@playwright/test';

test('boots to the title screen with a WebGL canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Crownstack' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  const canvas = page.getByTestId('game-canvas');
  await expect(canvas).toBeVisible();
  const hasContext = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    return c.width > 0 && c.height > 0;
  });
  expect(hasContext).toBe(true);
  expect(errors).toEqual([]);
});

test('serves an installable manifest and a service worker', async ({ page, request }) => {
  await page.goto('/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const manifest = (await (await request.get(manifestHref!)).json()) as {
    name: string;
    display: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBe('Crownstack');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);

  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
});
