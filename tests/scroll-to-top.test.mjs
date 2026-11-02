import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(repoRoot, 'src/components/ScrollToTop.jsx'), 'utf8');

assert.match(
  source,
  /window\.scrollTo\(0, 0\);[\s\S]*?\}, \[pathname\]\);/,
  'scroll reset should only depend on pathname changes',
);
assert.match(
  source,
  /checkAndTrackNotificationClick\(\);[\s\S]*?\}, \[pathname, search\]\);/,
  'notification click tracking should still react to query parameters',
);

console.log('scroll-to-top.test.mjs: 2 passed, 0 failed');
