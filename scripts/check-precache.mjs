// Enforces the "total precache <= 5 MB" budget (SPEC §7.3) by reading the
// Workbox precache manifest out of the generated service worker.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT_BYTES = 5 * 1024 * 1024;
const DIST = 'dist';

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
const urls = [...new Set([...sw.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]))];
if (urls.length === 0) {
  console.error('check-precache: no precache entries found in dist/sw.js');
  process.exit(1);
}

const total = urls.reduce((sum, url) => sum + statSync(join(DIST, url)).size, 0);
const mb = (total / 1024 / 1024).toFixed(2);
console.log(`precache: ${urls.length} files, ${mb} MB (limit 5 MB)`);
if (total > LIMIT_BYTES) {
  console.error('check-precache: precache budget exceeded');
  process.exit(1);
}
