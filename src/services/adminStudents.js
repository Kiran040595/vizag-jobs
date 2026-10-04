import { supabase } from '../lib/supabaseClient.js';
import {
  mapStudentProfileRow,
} from '../lib/adminStudentProfile.js';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

export { formatStudentRegisteredAt, mapStudentProfileRow } from '../lib/adminStudentProfile.js';
export { studentSearchBlob } from '../lib/adminStudentProfile.js';

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
          .range(pageFrom, pageTo)
      );
      from += PAGE_SIZE;
    }

    const responses = await Promise.all(pagePromises);
    for (const res of responses) {
      if (res.error) {
        console.warn('[adminStudents] Error fetching student batch:', res.error);
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
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.warn('[adminStudents] Error fetching student batch:', error);
        break;
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  return allRows.map((row) => mapStudentProfileRow(row));
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
