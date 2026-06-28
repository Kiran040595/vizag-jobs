import assert from 'node:assert/strict';
import {
  isSeoRetryableError,
  isSeoTimeoutOrGatewayError,
  maxSeoAttemptsForKeyPool,
  nextGeminiKeyIndex,
  parseGeminiKeyIndexFromError,
  parseSeoRetryWaitMs,
  SEO_RETRY_DELAY_MS,
} from '../src/lib/seoRetry.js';

let failures = 0;
const run = (label, fn) => {
  try {
    fn();
    console.log(`  OK    ${label}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${label} — ${err.message}`);
  }
};

const keys = [
  { index: 1, label: 'GEMINI_API_KEY' },
  { index: 2, label: 'GEMINI_API_KEYS (#1)' },
  { index: 3, label: 'GEMINI_API_KEYS (#2)' },
  { index: 4, label: 'GEMINI_API_KEYS (#3)' },
];

run('detects timeout / 502 as retryable', () => {
  assert.equal(
    isSeoRetryableError(
      'Edge Function HTTP 502: SEO optimization exceeded the server time limit. Gemini key: Key 2 of 4',
    ),
    true,
  );
  assert.equal(isSeoTimeoutOrGatewayError('The user aborted a request.'), true);
});

run('parses gemini key index from error', () => {
  assert.equal(
    parseGeminiKeyIndexFromError('Gemini key: Key 3 of 4 · GEMINI_API_KEYS (#1)'),
    3,
  );
});

run('rotates to next gemini key', () => {
  assert.equal(nextGeminiKeyIndex(keys, 2), 3);
  assert.equal(nextGeminiKeyIndex(keys, 4), 1);
});

run('uses default delay for gateway errors', () => {
  assert.equal(parseSeoRetryWaitMs('Edge Function HTTP 502: timeout'), SEO_RETRY_DELAY_MS);
});

run('max attempts capped by key pool', () => {
  assert.equal(maxSeoAttemptsForKeyPool(keys), 4);
  assert.equal(maxSeoAttemptsForKeyPool([]), 2);
});

console.log('\n----');
if (failures === 0) {
  console.log('seo-retry.test.mjs: OK');
  process.exit(0);
} else {
  process.exit(1);
}
