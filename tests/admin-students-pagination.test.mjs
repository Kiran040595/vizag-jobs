import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = 'https://dummy.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'dummy-key';

const { supabase } = await import('../src/lib/supabaseClient.js');
const { fetchAdminStudentProfiles } = await import('../src/services/adminStudents.js');

test('fetchAdminStudentProfiles fetches all students beyond the 1000 row PostgREST limit', async () => {
  const originalFrom = supabase.from;

  const mockRows = Array.from({ length: 1450 }, (_, i) => ({
    id: `id-${i + 1}`,
    user_id: `user-${i + 1}`,
    full_name: `Student ${i + 1}`,
    contact_email: `student${i + 1}@example.com`,
    created_at: new Date(Date.now() - i * 1000).toISOString(),
    is_active: true,
  }));

  const calls = [];

  supabase.from = (table) => {
    assert.equal(table, 'student_profiles');
    return {
      select: (cols, options) => {
        return {
          order: (orderCol, orderOpts) => {
            return {
              range: async (from, to) => {
                calls.push({ from, to, countOption: options?.count });
                const pageData = mockRows.slice(from, to + 1);
                return {
                  data: pageData,
                  error: null,
                  count: 1450,
                };
              },
            };
          },
        };
      },
    };
  };

  try {
    const students = await fetchAdminStudentProfiles();

    assert.equal(students.length, 1450, 'Should fetch all 1450 students');
    assert.equal(students[0].fullName, 'Student 1');
    assert.equal(students[1449].fullName, 'Student 1450');

    // Verify it paginated:
    // First call: 0..999 with count: 'exact'
    // Second call: 1000..1449
    assert.equal(calls.length, 2, 'Should make 2 paginated requests');
    assert.deepEqual(calls[0], { from: 0, to: 999, countOption: 'exact' });
    assert.deepEqual(calls[1], { from: 1000, to: 1449, countOption: undefined });
  } finally {
    supabase.from = originalFrom;
  }
});
