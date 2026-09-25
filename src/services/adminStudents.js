import { supabase } from '../lib/supabaseClient';
import {
  formatStudentRegisteredAt,
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

  const { data, error } = await supabase
    .from('student_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw mapError(error, 'Could not load student registrations.');
  }

  return (data || []).map((row) => mapStudentProfileRow(row));
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
