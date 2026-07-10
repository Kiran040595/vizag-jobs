import { supabase } from '../lib/supabaseClient';
import { validateStudentConsents } from '../lib/studentConsent';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

export const recordStudentRegistrationConsents = async (consents, { userId } = {}) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  validateStudentConsents(consents);

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    resolvedUserId = user?.id;
  }

  if (!resolvedUserId) {
    throw new Error('You must be signed in.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('student_profiles')
    .update({
      consent_terms_at: now,
      consent_share_with_employers_at: now,
      consent_accurate_info_at: now,
      consent_age_18_at: now,
    })
    .eq('user_id', resolvedUserId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not save your consent preferences.');
  }

  return data;
};
