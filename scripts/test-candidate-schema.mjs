import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { normalizeJobRequirements } from '../src/lib/candidateEligibility.js';

// Pass a temporary @electric-sql/pglite/dist/index.js path, or install it locally.
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`create table public.student_profiles (user_id text primary key, full_name text, degree text);
    create table public.jobs (id text primary key, title text);
    insert into student_profiles values ('existing-student', 'Existing Student', 'Diploma');
    insert into jobs values ('existing-job', 'Legacy job');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261008090000_candidate_eligibility.sql', import.meta.url), 'utf8'));
  const oldStudent = (await db.query('select * from student_profiles where user_id = $1', ['existing-student'])).rows[0];
  assert.equal(oldStudent.full_name, 'Existing Student');
  assert.equal(oldStudent.education_status, null);
  assert.equal(oldStudent.willing_to_relocate, null);
  assert.deepEqual(oldStudent.interested_roles, []);
  const oldJob = (await db.query('select * from jobs where id = $1', ['existing-job'])).rows[0];
  assert.equal(oldJob.requirements_verified, false);
  assert.deepEqual(oldJob.accepted_degrees, []);
  const columns = (await db.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'student_profiles'")).rows.map(r => r.column_name);
  for (const name of ['current_city', 'current_area', 'education_status', 'gender', 'willing_to_relocate', 'interested_roles']) assert.ok(columns.includes(name));
  const record = { id: 'new-job', title: 'Diploma Technician', ...normalizeJobRequirements({ accepted_degrees: ['Diploma'], accepted_branches: ['Mechanical Engineering'], required_education_status: 'completed', required_experience: 'fresher', required_skills: ['AutoCAD'], preferred_skills: ['communication'], required_candidate_locations: ['Vizag'], accepts_relocation: true, requirements_verified: true }) };
  await db.query('insert into jobs select * from jsonb_populate_record(null::public.jobs, $1::jsonb)', [JSON.stringify(record)]);
  const saved = (await db.query('select * from jobs where id = $1', ['new-job'])).rows[0];
  assert.deepEqual(saved, record);
  await db.query("update student_profiles set current_city = 'Vizag', current_area = 'Gajuwaka', gender = 'female', education_status = 'completed', willing_to_relocate = false, interested_roles = array['Technician'] where user_id = 'existing-student'");
  for (const sql of [
    "update student_profiles set gender = 'invalid'",
    "update student_profiles set education_status = 'unknown'",
    "update student_profiles set current_city = repeat('x', 65)",
    "update student_profiles set interested_roles = array_fill('Role'::text, array[17])",
    "update student_profiles set interested_roles = array[null]::text[]",
    "update jobs set accepted_degrees = array['Invalid']",
    "update jobs set accepted_branches = array['Invalid']",
    "update jobs set required_education_status = 'unknown'",
    "update jobs set required_experience = 'senior'",
    "update jobs set required_skills = array_fill('skill'::text, array[17])",
    "update jobs set required_candidate_locations = array[null]::text[]",
  ]) await assert.rejects(db.exec(sql), error => error.code === '23514');
  console.log('Candidate migration: PostgreSQL execution, new columns, defaults, existing data, payload round-trip, and 11 invalid-write constraints passed.');
} finally { await db.close(); }
