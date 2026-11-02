import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldIgnoreError } from '../src/lib/errorReporter.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainSrc = readFileSync(path.join(repoRoot, 'src/main.jsx'), 'utf8');
const errorBoundarySrc = readFileSync(path.join(repoRoot, 'src/components/ErrorBoundary.jsx'), 'utf8');
const apiHandlerSrc = readFileSync(path.join(repoRoot, 'api/report-error.js'), 'utf8');
const jobDetailsSrc = readFileSync(path.join(repoRoot, 'src/pages/JobDetailsPage.jsx'), 'utf8');
const pwaRecoverySrc = readFileSync(path.join(repoRoot, 'src/lib/pwaRecovery.js'), 'utf8');

// 1. Verify ignore filters for noise
assert.equal(shouldIgnoreError(null), true, 'null error should be ignored');
assert.equal(shouldIgnoreError(''), true, 'empty error should be ignored');
assert.equal(shouldIgnoreError(new Error('ResizeObserver loop limit exceeded')), true, 'ResizeObserver should be ignored');
assert.equal(shouldIgnoreError(new Error('ResizeObserver loop completed with undelivered notifications.')), true);
assert.equal(shouldIgnoreError(new Error('chrome-extension://xyz/content.js error')), true, 'chrome-extension should be ignored');
assert.equal(shouldIgnoreError('Script error.'), true, 'raw script error should be ignored');

// Instagram & In-App Browser noise should be ignored
const iabPostMessageError = new Error('Error invoking postMessage: Java object is gone');
iabPostMessageError.stack = 'Error: Error invoking postMessage: Java object is gone\n    at sendDataToNative (iabjs://navigation_performance_logger_android:1:11853)';
assert.equal(shouldIgnoreError(iabPostMessageError), true, 'Instagram IAB Java object error must be ignored');

const iabExceptionError = new Error('Error invoking postMessage: Java exception was raised during method invocation');
assert.equal(shouldIgnoreError(iabExceptionError), true, 'IAB Java exception error must be ignored');

const iabButtonsError = new Error('Error invoking enableButtonsClickedMetaDataLogging: Java object is gone');
assert.equal(shouldIgnoreError(iabButtonsError), true, 'IAB enableButtons error must be ignored');

const autofillError = new Error("Can't find variable: _AutofillCallbackHandler");
assert.equal(shouldIgnoreError(autofillError), true, 'Autofill handler extension noise must be ignored');

const storageDeniedError = new Error("Failed to read the 'localStorage' property from 'Window': Access is denied for this document.");
assert.equal(shouldIgnoreError(storageDeniedError), true, 'Storage access denied noise must be ignored');

const sessionStorageDeniedError = new Error("Failed to read the 'sessionStorage' property from 'Window': Access is denied for this document.");
assert.equal(shouldIgnoreError(sessionStorageDeniedError), true, 'SessionStorage access denied noise must be ignored');

const requestDeniedError = new Error('The request was denied.');
assert.equal(shouldIgnoreError(requestDeniedError), true, 'Safari private storage denial must be ignored');

const regDeniedError = new Error('Registration failed - permission denied');
assert.equal(shouldIgnoreError(regDeniedError), true, 'SW permission denied must be ignored');

const adsNoiseError = new Error('int64');
assert.equal(shouldIgnoreError(adsNoiseError), true, 'Google ads int64 telemetry noise must be ignored');

const replaceStateNoiseError = new Error('Attempt to use history.replaceState() more than 100 times per 10 seconds');
assert.equal(shouldIgnoreError(replaceStateNoiseError), true, 'replaceState WebKit noise must be ignored');

// 2. Legitimate errors MUST NOT be ignored
const realError = new TypeError("Cannot read properties of undefined (reading 'title')");
assert.equal(shouldIgnoreError(realError), false, 'Real application error should NOT be ignored');

const networkError = new Error('Network request failed at fetchMyJobs');
assert.equal(shouldIgnoreError(networkError), false, 'Network error should NOT be ignored');

// 3. Verify ErrorBoundary, main.jsx, and pwa integrations
assert.match(mainSrc, /initGlobalErrorListeners\(\)/, 'main.jsx must call initGlobalErrorListeners()');
assert.match(mainSrc, /Object\.hasOwn/, 'main.jsx must polyfill Object.hasOwn for older Android browsers');
assert.match(errorBoundarySrc, /reportClientError/, 'ErrorBoundary must import reportClientError');
assert.match(errorBoundarySrc, /componentDidCatch\(error, info\) \{[\s\S]*reportClientError\(/, 'ErrorBoundary must invoke reportClientError in componentDidCatch');
assert.match(pwaRecoverySrc, /onRegisterError/, 'pwaRecovery must provide onRegisterError to catch SW registration failures');
assert.match(jobDetailsSrc, /canonicalRedirectAttemptedRef/, 'JobDetailsPage must use canonicalRedirectAttemptedRef to prevent replaceState loop');

// 4. Verify API handler exports
assert.match(apiHandlerSrc, /export default async function handler/, 'api/report-error.js must export default handler');
assert.match(apiHandlerSrc, /RESEND_API_KEY/, 'api/report-error.js must check RESEND_API_KEY');
assert.match(apiHandlerSrc, /status: \(test \|\| isNoiseReport\) \? 'ignored' : 'open'/, 'api/report-error.js must mark noise as ignored');

console.log('error-reporter.test.mjs: OK');
