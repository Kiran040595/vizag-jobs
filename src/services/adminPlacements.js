import { supabase } from '../lib/supabaseClient.js';

export const mapPlacementRecord = (row, source = 'direct_application') => {
  if (!row) return null;
  const student = row.student || {};
  const snap = row.profile_snapshot || {};
  const job = row.job || {};
  const userId = row.student_user_id || row.candidate_user_id || student.user_id;

  return {
    id: row.id,
    applicationId: row.id,
    source,
    userId,
    fullName: student.full_name || snap.fullName || snap.name || 'Candidate',
    phone: student.phone || snap.phone || '',
    email: student.contact_email || snap.email || '',
    degree: student.degree || snap.degree || '',
    branch: student.branch || snap.branch || '',
    college: student.college || snap.college || '',
    graduationYear: student.graduation_year || snap.graduationYear || null,
    jobId: job.id,
    jobTitle: job.title || snap.jobTitle || 'Job Role',
    company: job.company || snap.company || 'Company',
    jobLocation: job.location || '',
    hiredStatus: row.status,
    hiredAt: row.updated_at || row.assigned_at || row.submitted_at,
    isPaid: Boolean(student.is_paid),
    paymentAmount: student.payment_amount != null ? Number(student.payment_amount) : null,
    paymentDate: student.payment_date || null,
    placedCompany: student.placed_company || job.company || '',
    paymentNotes: student.payment_notes || '',
    studentProfile: {
      ...student,
      userId,
      fullName: student.full_name || snap.fullName || 'Candidate',
      phone: student.phone || snap.phone || '',
      contactEmail: student.contact_email || snap.email || '',
      isPaid: Boolean(student.is_paid),
      paymentAmount: student.payment_amount != null ? Number(student.payment_amount) : null,
      paymentDate: student.payment_date || null,
      placedCompany: student.placed_company || job.company || '',
      paymentNotes: student.payment_notes || '',
    },
  };
};

export const fetchAdminPlacements = async () => {
  if (!supabase) return [];

  try {
    const [appsRes, suitableRes] = await Promise.all([
      supabase
        .from('job_applications')
        .select(`
          id,
          status,
          submitted_at,
          updated_at,
          student_user_id,
          profile_snapshot,
          job:jobs(id, title, company, role, location, status),
          student:student_profiles(user_id, full_name, phone, contact_email, degree, branch, college, graduation_year, is_paid, payment_amount, payment_date, placed_company, payment_notes)
        `)
        .in('status', ['hired', 'joined'])
        .order('updated_at', { ascending: false }),
      supabase
        .from('job_suitable_profiles')
        .select(`
          id,
          status,
          assigned_at,
          updated_at,
          candidate_user_id,
          profile_snapshot,
          job:jobs(id, title, company, role, location, status),
          student:student_profiles(user_id, full_name, phone, contact_email, degree, branch, college, graduation_year, is_paid, payment_amount, payment_date, placed_company, payment_notes)
        `)
        .in('status', ['hired', 'joined'])
        .order('updated_at', { ascending: false }),
    ]);

    const directList = (appsRes.data || []).map((row) => mapPlacementRecord(row, 'direct_application')).filter(Boolean);
    const suitableList = (suitableRes.data || []).map((row) => mapPlacementRecord(row, 'suitable_profile')).filter(Boolean);

    const merged = [...directList, ...suitableList];
    merged.sort((a, b) => new Date(b.hiredAt || 0).getTime() - new Date(a.hiredAt || 0).getTime());

    // Deduplicate multiple hire records for the same candidate & job
    const seen = new Set();
    const unique = [];
    for (const item of merged) {
      const key = `${item.userId}_${item.jobId}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    return unique;
  } catch (err) {
    console.error('Error fetching admin placements:', err);
    return [];
  }
};

export const fetchCandidateActivePlacements = async (candidateUserIds = []) => {
  if (!supabase || !candidateUserIds.length) return new Map();

  try {
    const [appsRes, suitableRes] = await Promise.all([
      supabase
        .from('job_applications')
        .select('id, status, updated_at, student_user_id, job:jobs(id, title, company)')
        .in('student_user_id', candidateUserIds)
        .in('status', ['hired', 'joined']),
      supabase
        .from('job_suitable_profiles')
        .select('id, status, updated_at, candidate_user_id, job:jobs(id, title, company)')
        .in('candidate_user_id', candidateUserIds)
        .in('status', ['hired', 'joined']),
    ]);

    const map = new Map();

    const processRow = (row, userIdKey) => {
      const uid = row[userIdKey];
      if (!uid || map.has(uid)) return;
      map.set(uid, {
        company: row.job?.company || 'Company',
        jobTitle: row.job?.title || 'Job Role',
        jobId: row.job?.id,
        hiredAt: row.updated_at,
        status: row.status,
      });
    };

    (appsRes.data || []).forEach((row) => processRow(row, 'student_user_id'));
    (suitableRes.data || []).forEach((row) => processRow(row, 'candidate_user_id'));

    return map;
  } catch (err) {
    console.warn('Could not load candidate active placements:', err?.message);
    return new Map();
  }
};

export const getDismissedHireAlerts = () => {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem('vizag_dismissed_hire_alerts');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

export const getReadHireAlerts = () => {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem('vizag_read_hire_alerts');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

export const markHireAlertRead = (id) => {
  try {
    if (typeof localStorage === 'undefined') return;
    const read = getReadHireAlerts();
    read.add(id);
    localStorage.setItem('vizag_read_hire_alerts', JSON.stringify([...read]));
  } catch {
    // ignore
  }
};

export const dismissHireAlert = (id) => {
  try {
    if (typeof localStorage === 'undefined') return;
    const dismissed = getDismissedHireAlerts();
    dismissed.add(id);
    localStorage.setItem('vizag_dismissed_hire_alerts', JSON.stringify([...dismissed]));
  } catch {
    // ignore
  }
};

export const dismissAllHireAlerts = (ids = []) => {
  try {
    if (typeof localStorage === 'undefined') return;
    const dismissed = getDismissedHireAlerts();
    ids.forEach((id) => dismissed.add(id));
    localStorage.setItem('vizag_dismissed_hire_alerts', JSON.stringify([...dismissed]));
  } catch {
    // ignore
  }
};

export const fetchAdminHireAlerts = async (limit = 10) => {
  const placements = await fetchAdminPlacements();
  const readSet = getReadHireAlerts();
  const dismissedSet = getDismissedHireAlerts();

  return placements
    .filter((p) => !dismissedSet.has(p.id))
    .slice(0, limit)
    .map((p) => ({
      ...p,
      isRead: Boolean(p.isPaid || readSet.has(p.id)),
    }));
};
