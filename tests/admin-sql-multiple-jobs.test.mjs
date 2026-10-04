import assert from 'node:assert/strict';
import {
  splitSqlValuesTuples,
  parseSqlInsertToRecords,
  parseSqlInsertToRecord,
  formatJobsToSqlInsert,
} from '../src/services/adminJobs.js';

// Test 1: splitSqlValuesTuples
const testSingleTuple = "('val1', 'val2', 123)";
const singleParsed = splitSqlValuesTuples(testSingleTuple);
assert.equal(singleParsed.length, 1);
assert.equal(singleParsed[0], "'val1', 'val2', 123");

const testMultiTuples = `
  (
    'slug-1',
    'Java Full Stack Developer (Fresher)',
    '{"B.Tech (CSE)","MCA"}',
    'Developer''s Company',
    true
  ),
  (
    'slug-2',
    'Python Engineer',
    '{"FastAPI","SQL"}',
    'Vizag Tech',
    false
  );
`;
const multiParsed = splitSqlValuesTuples(testMultiTuples);
assert.equal(multiParsed.length, 2);
assert.match(multiParsed[0], /Developer''s Company/);
assert.match(multiParsed[0], /B\.Tech \(CSE\)/);
assert.match(multiParsed[1], /Python Engineer/);

// Test 2: parseSqlInsertToRecords with multi-row query
const multiRowSql = `
INSERT INTO public.jobs (
  slug,
  title,
  company,
  location,
  category,
  job_type,
  work_mode,
  experience,
  is_fresher,
  salary,
  apply_mode,
  apply_link,
  short_description,
  description,
  responsibilities,
  eligibility,
  warning,
  posted_at,
  expires_at,
  source_name,
  source_url,
  skills,
  company_logo_url,
  status,
  is_featured
) VALUES 
(
  'react-dev-vizag-1',
  'React Frontend Developer',
  'Shvintech India',
  'Visakhapatnam',
  'IT/Software',
  'Full-Time',
  'Work From Office',
  '0-1 Years',
  true,
  '₹20,000 - ₹30,000/month',
  'internal',
  NULL,
  'React developer opening in Vizag.',
  'Develop frontend using React and Tailwind.',
  '{"Build components","Fix UI bugs"}',
  '{"B.Tech (CSE/IT)","2024-2026 Batch"}',
  'Never pay money to apply.',
  '2026-05-04T10:30:00Z',
  NULL,
  'Admin Post',
  NULL,
  '{"React","JavaScript","Tailwind CSS"}',
  NULL,
  'published',
  false
),
(
  'python-dev-vizag-2',
  'Python Backend Engineer',
  'Vizag Tech Labs',
  'Visakhapatnam',
  'IT/Software',
  'Full-Time',
  'Hybrid',
  '1-3 Years',
  false,
  '₹35,000 - ₹50,000/month',
  'internal',
  NULL,
  'Python backend role in Vizag.',
  'Develop REST APIs using FastAPI and PostgreSQL.',
  '{"Build APIs","Maintain databases"}',
  '{"Degree in Computer Science"}',
  'Never pay money to apply.',
  '2026-05-04T10:30:00Z',
  NULL,
  'Admin Post',
  NULL,
  '{"Python","FastAPI","PostgreSQL"}',
  NULL,
  'published',
  false
);
`;

const records = parseSqlInsertToRecords(multiRowSql);
assert.equal(records.length, 2);

// Check record 1
assert.equal(records[0].title, 'React Frontend Developer');
assert.equal(records[0].company, 'Shvintech India');
assert.equal(records[0].is_fresher, true);
assert.deepEqual(records[0].skills, ['React', 'JavaScript', 'Tailwind CSS']);
assert.deepEqual(records[0].responsibilities, ['Build components', 'Fix UI bugs']);
assert.deepEqual(records[0].eligibility, ['B.Tech (CSE/IT)', '2024-2026 Batch']);
assert.equal(records[0].apply_mode, 'internal');
assert.equal(records[0].apply_link, null);

// Check record 2
assert.equal(records[1].title, 'Python Backend Engineer');
assert.equal(records[1].company, 'Vizag Tech Labs');
assert.equal(records[1].is_fresher, false);
assert.deepEqual(records[1].skills, ['Python', 'FastAPI', 'PostgreSQL']);
assert.equal(records[1].apply_mode, 'internal');
assert.equal(records[1].apply_link, null);

// Test 3: parseSqlInsertToRecord backwards compatibility
const firstRecord = parseSqlInsertToRecord(multiRowSql);
assert.equal(firstRecord.title, 'React Frontend Developer');

// Test 4: formatJobsToSqlInsert round-trip
const generatedSql = formatJobsToSqlInsert([
  {
    slug: 'job-one',
    title: 'Job One',
    company: "Acme O'Connor Corp",
    location: 'Visakhapatnam',
    category: 'IT/Software',
    job_type: 'Full-Time',
    work_mode: 'On-site',
    experience: 'Fresher',
    is_fresher: true,
    salary: '₹25,000/month',
    short_description: 'Short desc',
    description: 'Full desc',
    responsibilities: ['Do task 1', 'Do task 2'],
    eligibility: ['B.Tech (Mechanical, ECE)'],
    skills: ['Python', 'SQL'],
    status: 'published',
  },
  {
    slug: 'job-two',
    title: 'Job Two',
    company: 'Beta Labs',
    location: 'Visakhapatnam',
    category: 'Core Technical',
    job_type: 'Full-Time',
    work_mode: 'Remote',
    experience: '2+ Years',
    is_fresher: false,
    salary: '₹40,000/month',
    short_description: 'Short desc 2',
    description: 'Full desc 2',
    responsibilities: ['Responsibility A'],
    eligibility: ['Diploma / B.Tech'],
    skills: ['AutoCAD', 'SolidWorks'],
    status: 'published',
  },
]);

assert.match(generatedSql, /INSERT INTO public\.jobs/);
assert.match(generatedSql, /Acme O''Connor Corp/);
assert.match(generatedSql, /'internal'/);
assert.match(generatedSql, /NULL/);

const roundTripped = parseSqlInsertToRecords(generatedSql);
assert.equal(roundTripped.length, 2);
assert.equal(roundTripped[0].title, 'Job One');
assert.equal(roundTripped[0].company, "Acme O'Connor Corp");
assert.equal(roundTripped[0].apply_mode, 'internal');
assert.equal(roundTripped[0].apply_link, null);
assert.deepEqual(roundTripped[0].eligibility, ['B.Tech (Mechanical, ECE)']);
assert.equal(roundTripped[1].title, 'Job Two');
assert.equal(roundTripped[1].company, 'Beta Labs');
assert.equal(roundTripped[1].apply_mode, 'internal');
assert.equal(roundTripped[1].apply_link, null);

console.log('admin-sql-multiple-jobs.test.mjs: ALL PASSED');
