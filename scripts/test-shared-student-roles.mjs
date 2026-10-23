import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create table public.student_profiles (user_id text primary key, primary_target_role text, interested_roles text[]);
    create table public.jobs (id text primary key, role text, title text, status text);
    create function public.clean_job_role_label(text) returns text language sql immutable as $$ select nullif(trim($1), '') $$;
    insert into student_profiles values ('legacy', ' Robotics   Technician ', array['robotics technician', 'C++ Developer', 'C# Developer']);
    insert into jobs values ('published', 'Job-only Technician', 'Job-only Technician', 'published'),
      ('private', 'Private role', 'Private role', 'draft');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261023120000_shared_student_roles.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query('select count(*)::int as n from student_role_catalog')).rows[0].n, 3);
  await db.exec(`insert into student_profiles values ('first-student', 'New Maritime Technician', array['Marine QA', 'marine   qa']);`);
  await db.exec('set role anon');
  assert.deepEqual((await db.query("select * from student_role_suggestions('maritime', 60)")).rows, [{ role: 'New Maritime Technician' }]);
  assert.equal((await db.query("select * from student_role_suggestions('marine', 60)")).rows.length, 1);
  assert.equal((await db.query("select * from student_role_suggestions('private', 60)")).rows.length, 0);
  assert.equal((await db.query("select * from student_role_suggestions('job-only', 60)")).rows.length, 1);
  assert.equal((await db.query("select * from student_role_suggestions('C++', 60)")).rows.length, 1);
  assert.equal((await db.query("select * from student_role_suggestions('C#', 60)")).rows.length, 1);
  assert.equal((await db.query("select * from student_role_suggestions('%', 60)")).rows.length, 0);
  await assert.rejects(db.query('select * from student_profiles'), error => error.code === '42501');
  await assert.rejects(db.query('select * from student_role_catalog'), error => error.code === '42501');
  await assert.rejects(db.query("insert into student_role_catalog values ('untrusted', 'untrusted')"), error => error.code === '42501');
  await db.exec('reset role');
  await db.exec(`update student_profiles set primary_target_role = 'Updated Maritime Role', interested_roles = array['New Secondary Role'] where user_id = 'first-student';
    insert into student_profiles values ('duplicate', 'updated  MARITIME role', '{}');`);
  await db.exec(`insert into student_profiles select 'bulk-' || i, 'A Common Role ' || i, '{}'::text[] from generate_series(1, 220) i;`);
  await db.exec('set role authenticated');
  assert.equal((await db.query("select * from student_role_suggestions('', 1000)")).rows.length, 200);
  assert.equal((await db.query("select * from student_role_suggestions('updated maritime', 1)")).rows.length, 1);
  assert.equal((await db.query("select * from student_role_suggestions('new secondary', 60)")).rows.length, 1);
  await db.exec('reset role');
  // A failed profile transaction must not leave a public suggestion behind.
  await db.exec(`begin; insert into student_profiles values ('rollback', 'Rolled Back Role', '{}'); rollback;`);
  assert.equal((await db.query("select * from student_role_suggestions('rolled back', 60)")).rows.length, 0);
  console.log('Shared student roles PostgreSQL checks passed: backfill, profile insert/update, cross-session public suggestions, deduplication, rare-role search, published jobs, punctuation, result bounds, transaction rollback, and access controls.');
} finally {
  await db.close();
}
