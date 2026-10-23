import assert from 'node:assert/strict';
import { pipelineConfig } from './lib/pipeline-env.mjs';

// Read-only deployment smoke. Never print credentials or student/role data.
const { supabaseUrl, supabaseAnonKey } = pipelineConfig;
assert.ok(supabaseUrl && supabaseAnonKey, 'Supabase URL and public anon key are required.');
const headers = { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' };

async function suggestions(search_text = '', limit_count = 60) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/student_role_suggestions`, {
    method: 'POST', headers, body: JSON.stringify({ search_text, limit_count }),
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `Public suggestion RPC returned HTTP ${response.status}.`);
  const rows = await response.json();
  assert.ok(Array.isArray(rows));
  assert.ok(rows.length <= Math.max(1, Math.min(limit_count, 200)));
  for (const row of rows) {
    assert.deepEqual(Object.keys(row), ['role'], 'Only role labels may be returned publicly.');
    assert.ok(typeof row.role === 'string' && row.role.trim().length > 0 && row.role.length <= 120);
  }
  assert.equal(new Set(rows.map(row => row.role.toLowerCase())).size, rows.length);
  return rows;
}

const initial = await suggestions('', 1000);
assert.ok(initial.length > 0, 'Expected the existing roles backfill or published jobs to provide suggestions.');
// A separate stateless request has no browser storage or student session.
const query = initial[0].role.slice(0, 120).toLowerCase();
const independent = await suggestions(query, 200);
assert.ok(independent.some(row => row.role.toLowerCase() === query), 'Role must be discoverable by an independent public caller.');
const direct = await fetch(`${supabaseUrl}/rest/v1/student_role_catalog?select=label&limit=1`, {
  headers, signal: AbortSignal.timeout(30_000),
});
assert.ok([401, 403].includes(direct.status), `Direct catalog access must be denied; received HTTP ${direct.status}.`);
console.log(`Deployed shared-role API smoke passed: ${initial.length} role-only suggestions, independent anonymous search, deduplication, result bounds, and direct catalog access denied.`);
