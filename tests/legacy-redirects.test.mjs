/**
 * Run with: node tests/legacy-redirects.test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_ROUTE_REDIRECTS } from '../src/lib/legacyRedirects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vercelConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'),
);

let pass = 0;
let fail = 0;

const ok = (cond, label) => {
  if (cond) {
    pass += 1;
    console.log(`  OK    ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}`);
  }
};

const routeRedirects = Object.fromEntries(
  (vercelConfig.redirects || [])
    .filter((entry) => entry.source && entry.destination && !entry.has)
    .map((entry) => [entry.source, entry.destination]),
);

for (const [source, destination] of Object.entries(LEGACY_ROUTE_REDIRECTS)) {
  ok(routeRedirects[source] === destination, `${source} -> ${destination}`);
}

ok(
  Object.keys(routeRedirects).length === Object.keys(LEGACY_ROUTE_REDIRECTS).length,
  'vercel.json has no extra legacy route redirects',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
