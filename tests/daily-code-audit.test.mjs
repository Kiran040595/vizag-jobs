import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// 1. Verify ledger exists and parses
const ledgerPath = path.join(repoRoot, 'data/daily_code_audit_ledger.json');
assert.ok(existsSync(ledgerPath), 'daily_code_audit_ledger.json must exist');
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));

assert.equal(ledger.schedule.frequency, 'daily');
assert.equal(ledger.schedule.functionsPerDay, 1);
assert.ok(Array.isArray(ledger.history), 'ledger.history must be an array');
assert.ok(Array.isArray(ledger.queue), 'ledger.queue must be an array');
assert.ok(ledger.history.length > 0, 'ledger must have at least one audited record in history');
assert.ok(ledger.queue.length > 0, 'ledger must have queued upcoming functions');

// 2. Verify all targets in ledger history and queue exist in repo
const allEntries = [...ledger.history, ...ledger.queue];
for (const entry of allEntries) {
  const filePath = path.join(repoRoot, entry.filePath);
  assert.ok(existsSync(filePath), `Target file ${entry.filePath} must exist for ${entry.functionName}`);

  const content = readFileSync(filePath, 'utf8');
  const fnRegex = new RegExp(`\\b${entry.functionName}\\b`);
  assert.ok(fnRegex.test(content), `Function ${entry.functionName} must be present in ${entry.filePath}`);

  if (entry.testFile) {
    const testPath = path.join(repoRoot, entry.testFile);
    assert.ok(existsSync(testPath), `Test file ${entry.testFile} must exist`);
  }
}

// 3. Verify JobApplicantsModal.jsx obeys Rules of Hooks
const modalPath = path.join(repoRoot, 'src/components/admin/JobApplicantsModal.jsx');
const modalSrc = readFileSync(modalPath, 'utf8');

// Ensure no useEffect/useState is placed after early return `if (!isOpen) return null;`
const earlyReturnIndex = modalSrc.indexOf('if (!isOpen) return null;');
assert.ok(earlyReturnIndex !== -1, 'JobApplicantsModal must contain early return for isOpen');

const remainingCodeAfterReturn = modalSrc.slice(earlyReturnIndex);
assert.doesNotMatch(
  remainingCodeAfterReturn,
  /\buseEffect\s*\(/,
  'JobApplicantsModal must NOT call useEffect after if (!isOpen) return null',
);

// 4. Verify audit runner script exists
const scriptPath = path.join(repoRoot, 'scripts/daily-code-audit.mjs');
assert.ok(existsSync(scriptPath), 'daily-code-audit.mjs must exist');

console.log('✓ All daily code audit framework verification tests passed successfully!');
