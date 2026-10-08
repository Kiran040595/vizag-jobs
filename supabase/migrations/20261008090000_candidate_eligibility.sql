-- Additive candidate matching schema; existing accounts remain valid.
begin;
alter table public.student_profiles
  add column if not exists current_city text,
  add column if not exists current_area text,
  add column if not exists education_status text,
  add column if not exists gender text,
  add column if not exists willing_to_relocate boolean,
  add column if not exists interested_roles text[] not null default '{}';
alter table public.student_profiles
  add constraint student_education_status_valid check (education_status in ('studying', 'completed')),
  add constraint student_gender_valid check (gender in ('female', 'male', 'other', 'prefer_not_to_say')),
  add constraint student_current_city_length check (char_length(current_city) <= 64),
  add constraint student_current_area_length check (char_length(current_area) <= 64),
  add constraint student_interested_roles_limit check (cardinality(interested_roles) <= 16 and array_position(interested_roles, null) is null);
alter table public.jobs
  add column if not exists accepted_degrees text[] not null default '{}',
  add column if not exists accepted_branches text[] not null default '{}',
  add column if not exists required_education_status text,
  add column if not exists required_experience text,
  add column if not exists required_skills text[] not null default '{}',
  add column if not exists preferred_skills text[] not null default '{}',
  add column if not exists required_candidate_locations text[] not null default '{}',
  add column if not exists accepts_relocation boolean not null default false,
  add column if not exists requirements_verified boolean not null default false;
alter table public.jobs
  add constraint jobs_required_education_status_valid check (required_education_status in ('studying', 'completed')),
  add constraint jobs_required_experience_valid check (required_experience in ('fresher', 'experienced')),
  add constraint jobs_accepted_degrees_valid check (accepted_degrees <@ array['10th Pass', '12th Pass', 'ITI', 'Diploma', 'B.Tech', 'B.E', 'B.Sc', 'B.Com', 'BBA', 'BCA', 'MCA', 'M.Tech', 'MBA', 'Other']::text[] and array_position(accepted_degrees, null) is null),
  add constraint jobs_accepted_branches_valid check (accepted_branches <@ array['Computer Science (CSE)', 'Information Technology (IT)', 'Electronics & Communication (ECE)', 'Electrical & Electronics (EEE)', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Automobile Engineering', 'ITI Trade / Technical', 'Commerce', 'Accounting & Finance', 'Business Administration', 'Science (General)', 'Arts / Humanities', 'Not Applicable']::text[] and array_position(accepted_branches, null) is null),
  add constraint jobs_required_skills_limit check (cardinality(required_skills) <= 16 and array_position(required_skills, null) is null),
  add constraint jobs_preferred_skills_limit check (cardinality(preferred_skills) <= 16 and array_position(preferred_skills, null) is null),
  add constraint jobs_candidate_locations_limit check (cardinality(required_candidate_locations) <= 16 and array_position(required_candidate_locations, null) is null);
create index if not exists student_profiles_current_city_idx on public.student_profiles (lower(current_city));
create index if not exists student_profiles_interested_roles_idx on public.student_profiles using gin (interested_roles);
comment on column public.student_profiles.gender is 'Optional self-reported demographic data. Excluded from job eligibility and standard exports. Existing owner/admin RLS applies.';
comment on column public.jobs.requirements_verified is 'False for legacy jobs. Only explicitly reviewed structured requirements are evaluated.';
notify pgrst, 'reload schema';
commit;
