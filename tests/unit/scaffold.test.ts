import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('deployment config', () => {
  it('never long-caches the service worker', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const sw = vercel.headers.find((h) => h.source === '/sw.js');
    expect(sw?.headers[0]?.value).toContain('max-age=0');
  });
});
