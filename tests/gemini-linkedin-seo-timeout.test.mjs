import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const INDEX = path.join(repoRoot, 'supabase', 'functions', 'fetch-external-jobs', 'index.ts');
const PROMPT = path.join(repoRoot, 'supabase', 'functions', 'fetch-external-jobs', 'gemini-seo-prompt.ts');
const CLIENT = path.join(repoRoot, 'src', 'services', 'externalJobFetch.js');

const indexSrc = fs.readFileSync(INDEX, 'utf8');
const promptSrc = fs.readFileSync(PROMPT, 'utf8');
const clientSrc = fs.readFileSync(CLIENT, 'utf8');

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

console.log('\nLinkedIn post SEO timeout fixes');

run('compact prompt uses LINKEDIN_POST_COMPACT_TASKS', () => {
  assert.ok(promptSrc.includes('LINKEDIN_POST_COMPACT_TASKS'));
  assert.ok(promptSrc.includes('hashtags[] with 10 items'));
});

run('linkedin SEO uses single-model default', () => {
  assert.ok(/GEMINI_SEO_LINKEDIN_POST_MAX_MODELS/.test(indexSrc));
  assert.ok(/maxRetries:\s*1/.test(indexSrc));
});

run('no schema retry on timeout', () => {
  assert.ok(/isGeminiSeoTimeoutError/.test(indexSrc));
  assert.ok(/isGeminiSeoParseRetryError/.test(indexSrc));
});

run('linkedin hard cap raised', () => {
  assert.ok(/GEMINI_SEO_LINKEDIN_HARD_CAP_MS/.test(indexSrc));
  assert.match(indexSrc, /GEMINI_SEO_LINKEDIN_HARD_CAP_MS\s*=\s*112_000/);
});

run('client browser timeout >= 120s for linkedin posts', () => {
  assert.match(clientSrc, /isLinkedInPost\s*\?\s*120_000/);
});

console.log('\n----');
if (failures === 0) {
  console.log('gemini-linkedin-seo-timeout.test.mjs: OK');
  process.exit(0);
} else {
  console.log(`${failures} test(s) FAILED.`);
  process.exit(1);
}
