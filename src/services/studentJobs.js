import { supabase } from '../lib/supabaseClient';
import {
  isAllowedBranch,
  isAllowedDegree,
  isAllowedGraduationYear,
  parseSkillSelection,
} from '../lib/studentProfileOptions';
import { isValidStudentPhone, normalizeStudentPhone } from '../lib/studentPhoneAuth';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

const parseGraduationYear = (value) => {
  const text = String(value || '').trim();
  if (!isAllowedGraduationYear(text)) {
    return null;
  }
  return Number(text);
};

const parseCertifications = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 16);
  }
  return String(value || '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16);
};

const validateStudentProfilePayload = (profile) => {
  const fullName = String(profile.full_name || '').trim();
  const college = String(profile.college || '').trim();
  const degree = String(profile.degree || '').trim();
  const branch = String(profile.branch || '').trim();
  const graduationYear = parseGraduationYear(profile.graduation_year);
  const phone = normalizeStudentPhone(profile.phone);
  const skills = parseSkillSelection(profile.skills);
  const certifications = parseCertifications(profile.certifications);

  if (!fullName) {
    throw new Error('Full name is required.');
  }
  if (!college) {
    throw new Error('College / university is required.');
  }
  if (!isAllowedDegree(degree)) {
    throw new Error('Select your degree from the list.');
  }
  if (!isAllowedBranch(branch)) {
    throw new Error('Select your branch from the list.');
  }
  if (!graduationYear) {
    throw new Error('Select your graduation year.');
  }
  if (!isValidStudentPhone(phone)) {
    throw new Error('Enter a valid 10-digit Indian mobile number.');
  }
  if (skills.length === 0) {
    throw new Error('Select at least one skill.');
  }
  if (certifications.length === 0) {
    throw new Error('List certifications or courses completed (type None if not applicable).');
  }
  if (typeof profile.is_fresher !== 'boolean') {
    throw new Error('Select whether you are a fresher.');
  }

  return {
    full_name: fullName,
    college,
    degree,
    branch,
    graduation_year: graduationYear,
    phone,
    skills,
    certifications,
    is_fresher: profile.is_fresher,
    contact_email: profile.contact_email?.trim() || null,
  };
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

  const validated = validateStudentProfilePayload(profile);

  const payload = {
    user_id: user.id,
    ...validated,
    contact_email: validated.contact_email || user.email || null,
    is_active: true,
  };

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
