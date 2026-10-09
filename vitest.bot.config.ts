import { defineConfig } from 'vitest/config';

/** Runs the level-tuning bot table (`pnpm bot`); kept out of the normal test run because it is slow. */
export default defineConfig({
  test: { include: ['tests/bot/**/*.bot.ts'], environment: 'node' },
});
