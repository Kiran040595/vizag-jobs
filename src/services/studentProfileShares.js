import { supabase, supabasePublic } from '../lib/supabaseClient';
import {
  buildStudentShareCardSnapshot,
  getStudentShareUrl,
  isStudentShareToken,
  resolveStudentShareFields,
} from '../lib/studentProfileShare.js';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

const normalizeCompanyLabel = (value) => {
  const label = String(value || '').trim();
  return label ? label.slice(0, 120) : null;
};

export const createStudentProfileShare = async ({
  student,
  fieldIds,
  companyLabel = '',
}) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  if (!student?.userId) {
    throw new Error('Student profile is missing.');
  }

  const fields = resolveStudentShareFields(fieldIds);
  const cardSnapshot = buildStudentShareCardSnapshot(
    student,
    fields.map((field) => field.id),
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw mapError(userError, 'Could not verify admin session.');
  }
  if (!user?.id) {
    throw new Error('You must be signed in as an admin to share student data.');
  }

  const { data, error } = await supabase
    .from('student_profile_shares')
    .insert({
      student_user_id: student.userId,
      created_by: user.id,
      company_label: normalizeCompanyLabel(companyLabel),
      selected_fields: fields.map((field) => field.id),
      card_snapshot: cardSnapshot,
    })
    .select('id, share_token, company_label, selected_fields, card_snapshot, created_at')
    .single();

  if (error) {
    throw mapError(error, 'Could not create student share link.');
  }

  return {
    id: data.id,
    shareToken: data.share_token,
    companyLabel: data.company_label || '',
    selectedFields: data.selected_fields || [],
    card: data.card_snapshot || {},
    createdAt: data.created_at,
    shareUrl: getStudentShareUrl(data.share_token),
  };
};

export const fetchStudentProfileShareByToken = async (token) => {
  if (!supabasePublic) {
    throw new Error('Supabase is not configured.');
  }

  const normalized = String(token || '').trim();
  if (!isStudentShareToken(normalized)) {
    throw new Error('Invalid share link.');
  }

  const { data, error } = await supabasePublic.rpc('get_student_profile_share', {
    p_token: normalized,
  });

  if (error) {
    throw mapError(error, 'Could not load shared student card.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('This share link is invalid or has been revoked.');
  }

  return {
    shareToken: data.shareToken || normalized,
    companyLabel: data.companyLabel || '',
    selectedFields: Array.isArray(data.selectedFields) ? data.selectedFields : [],
    card: data.card || {},
    createdAt: data.createdAt || null,
    shareUrl: getStudentShareUrl(data.shareToken || normalized),
  };
};
