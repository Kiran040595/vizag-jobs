import { supabase } from '../lib/supabaseClient';
import {
  buildJobStatsMap,
  formatEmployerRegisteredAt,
  mapEmployerProfileRow,
} from '../lib/adminEmployerProfile.js';

const JOBS_TABLE = import.meta.env.VITE_SUPABASE_JOBS_TABLE || 'jobs';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

export { formatEmployerRegisteredAt, mapEmployerProfileRow } from '../lib/adminEmployerProfile.js';
export { employerSearchBlob } from '../lib/adminEmployerProfile.js';

export const fetchAdminEmployerProfiles = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const [profilesResult, jobsResult] = await Promise.all([
    supabase
      .from('employer_profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from(JOBS_TABLE).select('created_by, status').not('created_by', 'is', null),
  ]);

  if (profilesResult.error) {
    throw mapError(profilesResult.error, 'Could not load employer registrations.');
  }
  if (jobsResult.error) {
    throw mapError(jobsResult.error, 'Could not load employer job counts.');
  }

  const statsByUser = buildJobStatsMap(jobsResult.data);

  return (profilesResult.data || []).map((row) =>
    mapEmployerProfileRow(row, statsByUser[row.user_id] || null),
  );
};

export const setEmployerActiveStatus = async ({ userId, isActive }) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('employer_profiles')
    .update({ is_active: Boolean(isActive) })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update employer status.');
  }

  return mapEmployerProfileRow(data);
};
