import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldIgnoreError } from '../src/lib/errorReporter.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainSrc = readFileSync(path.join(repoRoot, 'src/main.jsx'), 'utf8');
const errorBoundarySrc = readFileSync(path.join(repoRoot, 'src/components/ErrorBoundary.jsx'), 'utf8');
const apiHandlerSrc = readFileSync(path.join(repoRoot, 'api/report-error.js'), 'utf8');

// 1. Verify ignore filters for noise
assert.equal(shouldIgnoreError(null), true, 'null error should be ignored');
assert.equal(shouldIgnoreError(''), true, 'empty error should be ignored');
assert.equal(shouldIgnoreError(new Error('ResizeObserver loop limit exceeded')), true, 'ResizeObserver should be ignored');
assert.equal(shouldIgnoreError(new Error('ResizeObserver loop completed with undelivered notifications.')), true);
assert.equal(shouldIgnoreError(new Error('chrome-extension://xyz/content.js error')), true, 'chrome-extension should be ignored');
assert.equal(shouldIgnoreError('Script error.'), true, 'raw script error should be ignored');

// 2. Legitimate errors MUST NOT be ignored
const realError = new TypeError("Cannot read properties of undefined (reading 'title')");
assert.equal(shouldIgnoreError(realError), false, 'Real application error should NOT be ignored');

const networkError = new Error('Network request failed at fetchMyJobs');
assert.equal(shouldIgnoreError(networkError), false, 'Network error should NOT be ignored');

// 3. Verify ErrorBoundary and main.jsx integrations
assert.match(mainSrc, /initGlobalErrorListeners\(\)/, 'main.jsx must call initGlobalErrorListeners()');
assert.match(errorBoundarySrc, /reportClientError/, 'ErrorBoundary must import reportClientError');
assert.match(errorBoundarySrc, /componentDidCatch\(error, info\) \{[\s\S]*reportClientError\(/, 'ErrorBoundary must invoke reportClientError in componentDidCatch');

// 4. Verify API handler exports
assert.match(apiHandlerSrc, /export default async function handler/, 'api/report-error.js must export default handler');
assert.match(apiHandlerSrc, /RESEND_API_KEY/, 'api/report-error.js must check RESEND_API_KEY');
assert.match(apiHandlerSrc, /kiran@jobsinvizag\.in/, 'api/report-error.js must default alert recipient to kiran@jobsinvizag.in');

console.log('error-reporter.test.mjs: OK');
