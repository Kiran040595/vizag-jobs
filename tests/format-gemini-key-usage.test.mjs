import assert from 'node:assert/strict';
import {
  appendGeminiKeyToSeoErrorMessage,
  formatGeminiKeyUsage,
} from '../src/lib/formatGeminiKeyUsage.js';

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

run('formats pool index and GEMINI_API_KEYS label', () => {
  const s = formatGeminiKeyUsage({
    gemini_key_index: 3,
    gemini_keys_total: 5,
    gemini_key_label: 'GEMINI_API_KEYS (#2)',
    gemini_key_hint: '…x7F2',
  });
  assert.equal(s, 'Key 3 of 5 · GEMINI_API_KEYS (#2) · …x7F2');
});

run('falls back to source name', () => {
  assert.equal(
    formatGeminiKeyUsage({ gemini_key_index: 1, gemini_keys_total: 1, gemini_key_source: 'GEMINI_API_KEY' }),
    'Key 1 of 1 · GEMINI_API_KEY',
  );
});

run('appendGeminiKeyToSeoErrorMessage adds last key on timeout', () => {
  const msg = appendGeminiKeyToSeoErrorMessage('SEO optimization exceeded the server time limit.', {
    gemini_key_index: 2,
    gemini_keys_total: 4,
    gemini_key_label: 'GEMINI_API_KEY',
    gemini_key_hint: '…9KpQ',
  });
  assert.ok(msg.includes('Gemini key: Key 2 of 4 · GEMINI_API_KEY · …9KpQ'));
});
console.log('\n----');
if (failures === 0) {
  console.log('format-gemini-key-usage.test.mjs: OK');
  process.exit(0);
} else {
  process.exit(1);
}
