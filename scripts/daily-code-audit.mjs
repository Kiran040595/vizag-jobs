#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const LEDGER_PATH = path.join(repoRoot, 'data', 'daily_code_audit_ledger.json');
const DOCS_AUDIT_PATH = path.join(repoRoot, 'docs', 'DAILY_CODE_AUDIT.md');

function loadLedger() {
  if (!existsSync(LEDGER_PATH)) {
    throw new Error(`Ledger file not found at ${LEDGER_PATH}`);
  }
  return JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
}

function saveLedger(ledger) {
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

function checkRulesOfHooks(sourceCode, fileName) {
  const issues = [];
  if (!fileName.endsWith('.jsx') && !fileName.endsWith('.tsx')) {
    return issues;
  }

  const lines = sourceCode.split('\n');
  let topLevelEarlyReturn = false;
  let earlyReturnLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for component-level early return (typically 2-space indentation, returning null)
    if (/^ {2}if\s*\(.*?\)\s*return\s+(null|undefined|false|true|<)/.test(rawLine)) {
      topLevelEarlyReturn = true;
      earlyReturnLineIndex = i + 1;
    }

    // Catch hook calls called after top-level early return
    if (topLevelEarlyReturn && /^ {2}(?:const|let|\[)?.*?\buse(Effect|State|Callback|Memo|Ref|Id|Context)\s*\(/.test(rawLine)) {
      issues.push(
        `Rule of Hooks violation at line ${i + 1}: React Hook called after component-level early return at line ${earlyReturnLineIndex}.`
      );
    }
  }

  return issues;
}

function runEslintOnFile(targetFile) {
  try {
    const relPath = path.relative(repoRoot, targetFile).replace(/\\/g, '/');
    const result = execSync(`npx eslint "${relPath}"`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: result.trim() };
  } catch (err) {
    return { ok: false, output: err.stdout || err.stderr || err.message };
  }
}

function runTestFile(testRelPath) {
  try {
    const fullTestPath = path.join(repoRoot, testRelPath);
    if (!existsSync(fullTestPath)) {
      return { ok: false, output: `Test file not found: ${testRelPath}` };
    }
    const result = execSync(`node "${testRelPath}"`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: result.trim() };
  } catch (err) {
    return { ok: false, output: err.stdout || err.stderr || err.message };
  }
}

function auditTarget({ functionName, filePath, testFile }) {
  const fullPath = path.join(repoRoot, filePath);
  console.log(`\n======================================================`);
  console.log(`🔍 DAILY CODE AUDIT: [${functionName}]`);
  console.log(`📂 Target File: ${filePath}`);
  console.log(`======================================================`);

  if (!existsSync(fullPath)) {
    throw new Error(`Target file does not exist: ${filePath}`);
  }

  const src = readFileSync(fullPath, 'utf8');

  // 1. Verify function exists in file
  const fnRegex = new RegExp(
    `(function\\s+${functionName}\\b|const\\s+${functionName}\\s*=|export\\s+(const|function)\\s+${functionName}\\b)`,
  );
  if (!fnRegex.test(src)) {
    console.warn(`⚠️ Warning: Exact declaration for '${functionName}' not found via standard regex.`);
  } else {
    console.log(`✓ Function signature verified in ${filePath}`);
  }

  // 2. Rules of hooks check
  const hookIssues = checkRulesOfHooks(src, path.basename(filePath));
  if (hookIssues.length > 0) {
    console.error(`❌ Rules of Hooks Issues detected:`);
    hookIssues.forEach((issue) => console.error(`  - ${issue}`));
  } else {
    console.log(`✓ Rules of Hooks check passed (no conditional hook calls detected).`);
  }

  // 3. ESLint check
  console.log(`🔍 Running ESLint analysis on ${filePath}...`);
  const eslintResult = runEslintOnFile(fullPath);
  if (!eslintResult.ok) {
    console.error(`❌ ESLint reported issues:\n${eslintResult.output}`);
  } else {
    console.log(`✓ ESLint static analysis passed with 0 errors.`);
  }

  // 4. Test execution
  let testResult = null;
  if (testFile) {
    console.log(`🧪 Running associated test: ${testFile}...`);
    testResult = runTestFile(testFile);
    if (!testResult.ok) {
      console.error(`❌ Test failed:\n${testResult.output}`);
    } else {
      console.log(`✓ Associated test passed cleanly.`);
    }
  }

  const allPassed = hookIssues.length === 0 && eslintResult.ok && (!testResult || testResult.ok);
  console.log(`------------------------------------------------------`);
  console.log(`Audit Summary for [${functionName}]: ${allPassed ? '✅ PASSED' : '⚠️ ISSUES DETECTED'}`);
  console.log(`------------------------------------------------------\n`);

  return {
    allPassed,
    hookIssues,
    eslintResult,
    testResult,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const ledger = loadLedger();

  if (args.includes('--list')) {
    console.log(`\n📋 VizagJobs Daily Function Audit Schedule & Status`);
    console.log(`Audited History (${ledger.history.length} completed):`);
    ledger.history.forEach((h) => {
      console.log(`  [Day ${h.dayNumber} - ${h.date}] ${h.functionName} (${h.filePath}) -> ${h.status}`);
    });
    console.log(`\nUpcoming Queue (${ledger.queue.length} functions):`);
    ledger.queue.forEach((q) => {
      console.log(`  [Day ${q.dayNumber} - ${q.scheduledDate}] ${q.functionName} (${q.filePath})`);
    });
    return;
  }

  // Determine target function
  let target = null;
  const auditIdx = args.indexOf('--audit');
  if (auditIdx !== -1 && args[auditIdx + 1]) {
    const fnName = args[auditIdx + 1];
    target = [...ledger.history, ...ledger.queue].find((item) => item.functionName === fnName);
    if (!target) {
      console.error(`Function "${fnName}" not found in audit registry.`);
      process.exit(1);
    }
  } else {
    // Default or --next: pick next queued function
    if (ledger.queue.length === 0) {
      console.log('All queued functions have been audited! Add more functions to queue in data/daily_code_audit_ledger.json.');
      return;
    }
    target = ledger.queue[0];
  }

  const result = auditTarget(target);
  if (!result.allPassed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Audit runner error:', err);
  process.exit(1);
});
