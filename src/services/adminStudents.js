import { supabase } from '../lib/supabaseClient.js';
import { fetchCandidateActivePlacements } from './adminPlacements.js';
import {
  mapStudentProfileRow,
} from '../lib/adminStudentProfile.js';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

export { formatStudentRegisteredAt, mapStudentProfileRow } from '../lib/adminStudentProfile.js';
export { studentSearchBlob } from '../lib/adminStudentProfile.js';
export {
  fetchUserAccountStatus,
  fetchUsersAccountStatus,
  updateUserCredentials,
} from './adminAuthManagement.js';

export const fetchAdminStudentProfiles = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const PAGE_SIZE = 1000;
  let allRows = [];

  // Request the first page and ask Supabase for the exact total count
  const { data: firstPage, error: firstError, count } = await supabase
    .from('student_profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('user_id', { ascending: true })
    .range(0, PAGE_SIZE - 1);

  if (firstError) {
    throw mapError(firstError, 'Could not load student registrations.');
  }

  if (firstPage && firstPage.length > 0) {
    allRows = allRows.concat(firstPage);
  }

  const totalCount = typeof count === 'number' ? count : null;

  // If there are more than 1000 records, fetch all remaining pages
  if (totalCount !== null && totalCount > PAGE_SIZE) {
    const pagePromises = [];
    let from = PAGE_SIZE;

    while (from < totalCount) {
      const pageFrom = from;
      const pageTo = Math.min(pageFrom + PAGE_SIZE - 1, totalCount - 1);
      pagePromises.push(
        supabase
          .from('student_profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .order('user_id', { ascending: true })
          .range(pageFrom, pageTo)
      );
      from += PAGE_SIZE;
    }

    const responses = await Promise.all(pagePromises);
    for (const res of responses) {
      if (res.error) {
        throw mapError(res.error, 'Could not load every student batch. Refresh before targeting or exporting candidates.');
      } else if (res.data) {
        allRows = allRows.concat(res.data);
      }
    }
  } else if (totalCount === null && firstPage && firstPage.length === PAGE_SIZE) {
    // Fallback if exact count was not available
    let from = PAGE_SIZE;
    while (true) {
      const { data, error } = await supabase
        .from('student_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .order('user_id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw mapError(error, 'Could not load every student batch. Refresh before targeting or exporting candidates.');
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  const mappedStudents = allRows.map((row) => mapStudentProfileRow(row));
  const userIds = mappedStudents.map((s) => s.userId).filter(Boolean);
  if (userIds.length > 0) {
    try {
      const placementsMap = await fetchCandidateActivePlacements(userIds);
      if (placementsMap && placementsMap.size > 0) {
        for (const student of mappedStudents) {
          if (placementsMap.has(student.userId)) {
            student.activePlacement = placementsMap.get(student.userId);
          }
        }
      }
    } catch (err) {
      console.warn('Candidate placement enrichment warning:', err?.message);
    }
  }

  return mappedStudents;
};

export const updateStudentPlacementPayment = async ({
  userId,
  isPaid,
  paymentAmount = null,
  paymentDate = null,
  placedCompany = '',
  paymentNotes = '',
}) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  if (!userId) {
    throw new Error('Candidate user ID is required.');
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const payload = {
    is_paid: Boolean(isPaid),
    payment_amount: isPaid && paymentAmount != null ? Math.max(0, Number(paymentAmount)) : null,
    payment_date: isPaid ? (paymentDate || new Date().toISOString().slice(0, 10)) : null,
    placed_company: isPaid ? String(placedCompany || '').trim() : null,
    payment_notes: isPaid ? String(paymentNotes || '').trim() : null,
    payment_updated_at: new Date().toISOString(),
    payment_marked_by: authUser?.id || null,
  };

  const { data, error } = await supabase
    .from('student_profiles')
    .update(payload)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update student placement payment details.');
  }

  return mapStudentProfileRow(data);
};

export const setStudentActiveStatus = async ({ userId, isActive }) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('student_profiles')
    .update({ is_active: Boolean(isActive) })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update student status.');
  }

  return mapStudentProfileRow(data);
};

export const fetchAdminQuickCandidates = async () => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        id,
        job_id,
        status,
        student_user_id,
        quick_candidate_id,
        form_answers,
        form_snapshot,
        application_source,
        applied_role,
        submitted_at,
        candidate:quick_candidates(full_name, phone, needs_review),
        job:jobs(title, role, company, location)
      `)
      .not('quick_candidate_id', 'is', null)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.warn('Could not load quick candidates:', error.message);
      return [];
    }

    const { mergeQuickApplications } = await import('../lib/quickCandidateProfile.js');
    return mergeQuickApplications(data || []);
  } catch (err) {
    console.warn('Error loading quick candidates:', err?.message);
    return [];
  }
};
