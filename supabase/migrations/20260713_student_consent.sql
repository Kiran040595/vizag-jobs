-- Student registration consent audit trail (employer sharing, terms, age, accuracy).

alter table public.student_profiles
  add column if not exists consent_terms_at timestamptz,
  add column if not exists consent_share_with_employers_at timestamptz,
  add column if not exists consent_accurate_info_at timestamptz,
  add column if not exists consent_age_18_at timestamptz;
