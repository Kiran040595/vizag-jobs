import { supabase } from '../lib/supabaseClient';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

const parseSkills = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 24);
  }
  return String(value || '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
};

const parseGraduationYear = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1990 || n > 2040) {
    return null;
  }
  return n;
};

export const fetchStudentProfile = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const { data, error } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw mapError(error, 'Could not load your student profile.');
  }

  return data;
};

export const upsertStudentProfile = async (profile) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const payload = {
    user_id: user.id,
    full_name: String(profile.full_name || '').trim(),
    college: profile.college?.trim() || null,
    degree: profile.degree?.trim() || null,
    branch: profile.branch?.trim() || null,
    graduation_year: parseGraduationYear(profile.graduation_year),
    contact_email: profile.contact_email?.trim() || user.email,
    phone: profile.phone?.trim() || null,
    skills: parseSkills(profile.skills),
    is_fresher: profile.is_fresher !== false,
    is_active: true,
  };

  if (!payload.full_name) {
    throw new Error('Full name is required.');
  }

  const { data, error } = await supabase
    .from('student_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not save your profile.');
  }

  return data;
};
