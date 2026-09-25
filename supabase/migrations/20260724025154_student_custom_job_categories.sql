-- Allow custom typed job categories on student profiles (in addition to presets).
-- Element format is validated in the app (lowercase snake_case tokens).

alter table public.student_profiles
  drop constraint if exists student_profiles_target_job_categories_check;

alter table public.student_profiles
  add constraint student_profiles_target_job_categories_check
  check (cardinality(coalesce(target_job_categories, '{}'::text[])) <= 8);
