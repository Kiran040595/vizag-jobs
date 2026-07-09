import assert from 'node:assert/strict';
import {
  buildGeminiSeoKeySelectOptions,
  formatGeminiSeoKeyOptionLabel,
  parseGeminiSeoKeySelectValue,
} from '../src/lib/geminiSeoKeyOptions.js';

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

run('formatGeminiSeoKeyOptionLabel', () => {
  assert.equal(
    formatGeminiSeoKeyOptionLabel({ index: 2, label: 'GEMINI_API_KEYS (#1)', hint: '…x7F2' }),
    'Key 2 · GEMINI_API_KEYS (#1) · …x7F2',
  );
});

run('buildGeminiSeoKeySelectOptions includes default', () => {
  const options = buildGeminiSeoKeySelectOptions([
    { index: 1, label: 'GEMINI_API_KEY' },
    { index: 2, label: 'GEMINI_API_KEYS (#1)' },
  ]);
  assert.equal(options[0]?.value, '0');
  assert.equal(options[1]?.value, '1');
  assert.equal(options[2]?.value, '2');
});

run('parseGeminiSeoKeySelectValue', () => {
  assert.equal(parseGeminiSeoKeySelectValue('0'), 0);
  assert.equal(parseGeminiSeoKeySelectValue('3'), 3);
  assert.equal(parseGeminiSeoKeySelectValue('bad'), 0);
});

console.log('\n----');
if (failures === 0) {
  console.log('gemini-seo-key-options.test.mjs: OK');
  process.exit(0);
} else {
  process.exit(1);
}
