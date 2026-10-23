import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dummy.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'dummy-key';

const { supabase } = await import('../src/lib/supabaseClient.js');
const {
  buildCandidateSnapshot,
  mapSuitableProfile,
  assignCandidatesToJob,
} = await import('../src/services/jobSuitableProfiles.js');
import {
  formatApplicationStatus,
  normalizeApplicationStatus,
  getApplicationStatusStyle,
  getApplicationStatusDescription,
  SUITABLE_PROFILE_STATUS_OPTIONS,
} from '../src/lib/applicationStatus.js';
import { APPLICATION_EXPORT_COLUMNS } from '../src/lib/applicationExport.js';

test('buildCandidateSnapshot maps all relevant candidate qualifications and preferences', () => {
  const candidate = {
    userId: 'cand-101',
    fullName: 'Sai Krishna',
    phone: '9848011223',
    contactEmail: 'sai.krishna@example.com',
    college: 'Andhra University College of Engineering',
    degree: 'B.Tech',
    branch: 'Geoinformatics',
    graduationYear: 2025,
    isFresher: true,
    skills: ['GIS', 'Python', 'Remote Sensing', 'ArcGIS', 'QGIS'],
    certifications: ['Certified GIS Professional'],
    primaryTargetRole: 'GIS Developer',
    roleExperienceLevel: 'fresher',
    targetJobCategories: ['it-software', 'engineering'],
    preferredLocations: ['Visakhapatnam', 'Hyderabad'],
    availability: 'immediate',
    expectedSalaryMin: 25000,
    expectedSalaryMax: 35000,
    resumePath: 'resumes/cand-101-cv.pdf',
  };

  const snapshot = buildCandidateSnapshot(candidate);

  assert.equal(snapshot.fullName, 'Sai Krishna');
  assert.equal(snapshot.phone, '9848011223');
  assert.equal(snapshot.contactEmail, 'sai.krishna@example.com');
  assert.equal(snapshot.college, 'Andhra University College of Engineering');
  assert.equal(snapshot.degree, 'B.Tech');
  assert.equal(snapshot.branch, 'Geoinformatics');
  assert.equal(snapshot.graduationYear, 2025);
  assert.equal(snapshot.isFresher, true);
  assert.deepEqual(snapshot.skills, ['GIS', 'Python', 'Remote Sensing', 'ArcGIS', 'QGIS']);
  assert.deepEqual(snapshot.certifications, ['Certified GIS Professional']);
  assert.equal(snapshot.primaryTargetRole, 'GIS Developer');
  assert.equal(snapshot.roleExperienceLevel, 'fresher');
  assert.deepEqual(snapshot.preferredLocations, ['Visakhapatnam', 'Hyderabad']);
  assert.equal(snapshot.availability, 'immediate');
  assert.equal(snapshot.expectedSalaryMin, 25000);
  assert.equal(snapshot.expectedSalaryMax, 35000);
});

test('buildCandidateSnapshot handles empty or partial candidate gracefully', () => {
  assert.deepEqual(buildCandidateSnapshot(null), {});
  const partial = buildCandidateSnapshot({});
  assert.equal(partial.fullName, '');
  assert.equal(partial.phone, '');
  assert.deepEqual(partial.skills, []);
  assert.equal(partial.graduationYear, null);
});

test('mapSuitableProfile maps DB row to unified candidate card format', () => {
  const row = {
    id: 'sp-uuid-1',
    job_id: 'job-uuid-99',
    student_user_id: 'user-uuid-88',
    assigned_by: 'admin-uuid-1',
    admin_notes: 'Matched 2025 Batch GIS developer with strong Python skills',
    status: 'suitable',
    recruiter_notes: 'Spoke on phone, candidate interested in joining',
    interview_scheduled_at: '2026-10-28T10:00:00Z',
    interview_mode: 'in_person',
    interview_location: 'Rushikonda IT SEZ, Vizag',
    interview_instructions: 'Bring updated resume',
    profile_snapshot: {
      fullName: 'Ravi Teja',
      phone: '9849012345',
      degree: 'B.Tech',
      branch: 'Computer Science',
      graduationYear: 2026,
    },
    resume_path: 'resumes/ravi-cv.pdf',
    created_at: '2026-10-24T09:30:00Z',
    updated_at: '2026-10-24T10:00:00Z',
  };

  const mapped = mapSuitableProfile(row);

  assert.equal(mapped.id, 'sp-uuid-1');
  assert.equal(mapped.jobId, 'job-uuid-99');
  assert.equal(mapped.studentUserId, 'user-uuid-88');
  assert.equal(mapped.isSuitableProfile, true);
  assert.equal(mapped.adminNotes, 'Matched 2025 Batch GIS developer with strong Python skills');
  assert.equal(mapped.status, 'suitable');
  assert.equal(mapped.recruiterNotes, 'Spoke on phone, candidate interested in joining');
  assert.equal(mapped.interviewScheduledAt, '2026-10-28T10:00:00Z');
  assert.equal(mapped.interviewMode, 'in_person');
  assert.equal(mapped.interviewLocation, 'Rushikonda IT SEZ, Vizag');
  assert.equal(mapped.resumePath, 'resumes/ravi-cv.pdf');
  assert.equal(mapped.profileSnapshot.fullName, 'Ravi Teja');
});

test('suitable and contacted statuses are correctly recognized, styled, and described', () => {
  assert.equal(normalizeApplicationStatus('suitable'), 'suitable');
  assert.equal(normalizeApplicationStatus('SUITABLE'), 'suitable');
  assert.equal(normalizeApplicationStatus('contacted'), 'contacted');

  assert.equal(formatApplicationStatus('suitable'), 'Suitable Profile');
  assert.equal(formatApplicationStatus('contacted'), 'Contacted');

  const suitableStyle = getApplicationStatusStyle('suitable');
  assert.ok(suitableStyle.includes('amber'));

  const contactedStyle = getApplicationStatusStyle('contacted');
  assert.ok(contactedStyle.includes('sky'));

  const suitableDesc = getApplicationStatusDescription('suitable');
  assert.ok(suitableDesc.includes('recommended'));

  const contactedDesc = getApplicationStatusDescription('contacted');
  assert.ok(contactedDesc.includes('contacted'));

  assert.ok(SUITABLE_PROFILE_STATUS_OPTIONS.includes('suitable'));
  assert.ok(SUITABLE_PROFILE_STATUS_OPTIONS.includes('contacted'));
  assert.ok(SUITABLE_PROFILE_STATUS_OPTIONS.includes('screened'));
  assert.ok(SUITABLE_PROFILE_STATUS_OPTIONS.includes('interview_scheduled'));
  assert.ok(SUITABLE_PROFILE_STATUS_OPTIONS.includes('hired'));
  assert.ok(SUITABLE_PROFILE_STATUS_OPTIONS.includes('rejected'));
});

test('application export columns include admin recommendation notes', () => {
  const col = APPLICATION_EXPORT_COLUMNS.find((c) => c.id === 'adminNotes');
  assert.ok(col, 'adminNotes column must exist in export');
  assert.equal(col.group, 'Consultancy');
  assert.equal(
    col.getValue({ adminNotes: 'Top candidate for GIS role' }),
    'Top candidate for GIS role',
  );
  assert.equal(col.getValue({}), '');
});

test('assignCandidatesToJob validates required parameters', async () => {
  await assert.rejects(
    assignCandidatesToJob({ jobId: '', candidateUserIds: ['user-1'] }),
    /A target job must be selected/,
  );
  await assert.rejects(
    assignCandidatesToJob({ jobId: 'job-1', candidateUserIds: [] }),
    /At least one candidate must be selected/,
  );
});

test('assignCandidatesToJob executes bulk upserts in batches of 100', async () => {
  const originalFrom = supabase.from;
  const originalAuth = supabase.auth;

  const upsertChunks = [];

  supabase.auth = {
    getUser: async () => ({ data: { user: { id: 'admin-tester-1' } } }),
  };

  supabase.from = (table) => {
    assert.equal(table, 'job_suitable_profiles');
    return {
      upsert: (chunk, opts) => {
        upsertChunks.push({ count: chunk.length, onConflict: opts?.onConflict });
        return {
          select: async () => ({
            data: chunk.map((r, i) => ({ id: `assigned-${i}`, ...r })),
            error: null,
          }),
        };
      },
    };
  };

  try {
    // 245 candidates: should create 3 chunks (100, 100, 45)
    const candidates = Array.from({ length: 245 }, (_, i) => ({
      userId: `cand-${i + 1}`,
      fullName: `Candidate ${i + 1}`,
      primaryTargetRole: 'GIS Developer',
      skills: ['GIS', 'Python'],
    }));

    const result = await assignCandidatesToJob({
      jobId: 'target-job-uuid-1',
      candidateUserIds: candidates.map((c) => c.userId),
      adminNotes: 'Batch assignment test',
      candidateProfiles: candidates,
    });

    assert.equal(result.count, 245);
    assert.equal(upsertChunks.length, 3, '245 candidates should be processed in 3 batches');
    assert.equal(upsertChunks[0].count, 100);
    assert.equal(upsertChunks[1].count, 100);
    assert.equal(upsertChunks[2].count, 45);
    assert.equal(upsertChunks[0].onConflict, 'job_id,student_user_id');
  } finally {
    supabase.from = originalFrom;
    supabase.auth = originalAuth;
  }
});

