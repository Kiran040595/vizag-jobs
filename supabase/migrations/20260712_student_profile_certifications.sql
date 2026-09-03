-- Certifications / courses completed by students (for recruiter matching).

alter table public.student_profiles
  add column if not exists certifications text[] not null default '{}';

create index if not exists student_profiles_degree_idx on public.student_profiles (degree);
create index if not exists student_profiles_branch_idx on public.student_profiles (branch);
create index if not exists student_profiles_graduation_year_idx on public.student_profiles (graduation_year);
