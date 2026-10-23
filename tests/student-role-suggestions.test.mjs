import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = 'https://dummy.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'dummy-key';
const { supabasePublic } = await import('../src/lib/supabaseClient.js');
const { fetchStudentRoleSuggestions } = await import('../src/services/jobRoles.js');

test('registration suggestions query the shared database and normalize the search', async () => {
  const original = supabasePublic.rpc;
  supabasePublic.rpc = async (name, args) => {
    assert.equal(name, 'student_role_suggestions');
    assert.deepEqual(args, { search_text: 'Maritime Technician', limit_count: 200 });
    return { data: [{ role: ' Maritime   Technician ' }, { role: '' }], error: null };
  };
  try {
    assert.deepEqual(await fetchStudentRoleSuggestions(' Maritime   Technician ', 500), [{ role: 'Maritime Technician' }]);
  } finally { supabasePublic.rpc = original; }
});

test('job suggestions remain usable before the catalog migration is deployed', async () => {
  const original = supabasePublic.rpc;
  supabasePublic.rpc = async name => name === 'student_role_suggestions'
    ? { data: null, error: { code: 'PGRST202' } }
    : { data: [{ role: 'Maritime Technician', usage_count: 1 }, { role: 'Accountant', usage_count: 2 }], error: null };
  try {
    assert.deepEqual(await fetchStudentRoleSuggestions('maritime'), [{ role: 'Maritime Technician', usageCount: 1 }]);
  } finally { supabasePublic.rpc = original; }
});

test('an unavailable database keeps manual role entry usable', async () => {
  const original = supabasePublic.rpc;
  supabasePublic.rpc = async () => { throw new Error('offline'); };
  try { assert.deepEqual(await fetchStudentRoleSuggestions('new role'), []); }
  finally { supabasePublic.rpc = original; }
});
