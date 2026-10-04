import { supabase } from '../lib/supabaseClient';
import {
  buildJobStatsMap,
  mapEmployerProfileRow,
} from '../lib/adminEmployerProfile.js';

const JOBS_TABLE = import.meta.env.VITE_SUPABASE_JOBS_TABLE || 'jobs';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

export { formatEmployerRegisteredAt, mapEmployerProfileRow } from '../lib/adminEmployerProfile.js';
export { employerSearchBlob } from '../lib/adminEmployerProfile.js';

const getAdminCreateEmployerUrl = () => {
  const base = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!base) return '';
  return `${base}/functions/v1/admin-create-employer`;
};

export const fetchAdminEmployerProfiles = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const PAGE_SIZE = 1000;
  let allProfiles = [];

  const [{ data: firstProfiles, error: profilesError, count: profileCount }, jobsResult] =
    await Promise.all([
      supabase
        .from('employer_profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1),
      supabase.from(JOBS_TABLE).select('created_by, status').not('created_by', 'is', null),
    ]);

  if (profilesError) {
    throw mapError(profilesError, 'Could not load employer registrations.');
  }
  if (jobsResult.error) {
    throw mapError(jobsResult.error, 'Could not load employer job counts.');
  }

  if (firstProfiles && firstProfiles.length > 0) {
    allProfiles = allProfiles.concat(firstProfiles);
  }

  const totalProfiles = typeof profileCount === 'number' ? profileCount : null;
  if (totalProfiles !== null && totalProfiles > PAGE_SIZE) {
    const pagePromises = [];
    let from = PAGE_SIZE;
    while (from < totalProfiles) {
      const pageFrom = from;
      const pageTo = Math.min(pageFrom + PAGE_SIZE - 1, totalProfiles - 1);
      pagePromises.push(
        supabase
          .from('employer_profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .range(pageFrom, pageTo)
      );
      from += PAGE_SIZE;
    }
    const responses = await Promise.all(pagePromises);
    for (const res of responses) {
      if (res.data) {
        allProfiles = allProfiles.concat(res.data);
      }
    }
  }

  const statsByUser = buildJobStatsMap(jobsResult.data);

  return allProfiles.map((row) =>
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

/**
 * Admin-provisioned employer account (service-role edge function).
 * @param {{ companyName: string, email: string, password: string, phone: string, contactName?: string }} payload
 */
export const createAdminEmployerAccount = async (payload) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const url = getAdminCreateEmployerUrl();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error('Supabase functions URL is not configured.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('You must be signed in as an admin.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      companyName: payload.companyName,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      contactName: payload.contactName || '',
      industry: payload.industry || '',
      location: payload.location || '',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Could not create employer (HTTP ${response.status}).`);
  }

  if (data.employer?.userId && (payload.industry || payload.location)) {
    await supabase
      .from('employer_profiles')
      .update({
        industry: payload.industry || null,
        location: payload.location || null,
      })
      .eq('user_id', data.employer.userId);
  }

  const employer = data.employer
    ? {
        ...mapEmployerProfileRow({
          user_id: data.employer.userId,
          company_name: data.employer.companyName,
          contact_name: data.employer.contactName,
          contact_email: data.employer.contactEmail,
          phone: data.employer.phone,
          industry: payload.industry || data.employer.industry,
          location: payload.location || data.employer.location,
          website: data.employer.website,
          company_logo_url: data.employer.companyLogoUrl,
          is_active: data.employer.isActive,
          created_at: data.employer.createdAt,
          updated_at: data.employer.updatedAt,
        }),
        jobStats: { total: 0, pending: 0, published: 0 },
      }
    : null;

  return {
    employer,
    email: data.email || payload.email,
    message: data.message || 'Employer account created.',
  };
};
