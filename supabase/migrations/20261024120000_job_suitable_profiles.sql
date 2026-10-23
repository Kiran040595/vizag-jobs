-- Migration: 20261024120000_job_suitable_profiles.sql
-- Enables admin curation of candidate profiles directly assigned to companies/jobs as "Suitable Profiles"
-- Kept separate from job_applications to keep student applied history clean and separate.

create table if not exists public.job_suitable_profiles (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  admin_notes text,
  status text not null default 'suitable',
  recruiter_notes text,
  interview_scheduled_at timestamptz,
  interview_mode text default 'in_person',
  interview_location text,
  interview_instructions text,
  profile_snapshot jsonb not null default '{}'::jsonb,
  resume_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint job_suitable_profiles_job_student_key unique (job_id, student_user_id)
);

create index if not exists idx_job_suitable_profiles_job_id
  on public.job_suitable_profiles(job_id);

create index if not exists idx_job_suitable_profiles_student
  on public.job_suitable_profiles(student_user_id);

create index if not exists idx_job_suitable_profiles_status
  on public.job_suitable_profiles(job_id, status);

create index if not exists idx_job_suitable_profiles_created
  on public.job_suitable_profiles(job_id, created_at desc);

-- Trigger to maintain updated_at
drop trigger if exists set_job_suitable_profiles_updated_at on public.job_suitable_profiles;
create trigger set_job_suitable_profiles_updated_at
  before update on public.job_suitable_profiles
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.job_suitable_profiles enable row level security;

-- Admins full access
drop policy if exists "Admins manage suitable profiles" on public.job_suitable_profiles;
create policy "Admins manage suitable profiles"
  on public.job_suitable_profiles
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Employers who own the job can view assigned suitable profiles
drop policy if exists "Employers view suitable profiles for their jobs" on public.job_suitable_profiles;
create policy "Employers view suitable profiles for their jobs"
  on public.job_suitable_profiles
  for select
  to authenticated
  using (public.can_view_job_applications(job_id, auth.uid()));

-- Employers can update recruiter notes, interview scheduling, and status
drop policy if exists "Employers update suitable profiles for their jobs" on public.job_suitable_profiles;
create policy "Employers update suitable profiles for their jobs"
  on public.job_suitable_profiles
  for update
  to authenticated
  using (public.can_view_job_applications(job_id, auth.uid()))
  with check (public.can_view_job_applications(job_id, auth.uid()));

-- Update resume storage policy to allow employers to read resumes of suitable profiles
drop policy if exists "Moderators read application resumes" on storage.objects;
create policy "Moderators read application resumes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-resumes'
  and (
    exists (
      select 1
      from public.job_applications ja
      where ja.resume_path = storage.objects.name
        and public.can_view_job_applications(ja.job_id, auth.uid())
    )
    or exists (
      select 1
      from public.job_apply_clicks jac
      join public.student_profiles sp on sp.user_id = jac.user_id
      where sp.resume_path = storage.objects.name
        and public.can_view_job_applications(jac.job_id, auth.uid())
    )
    or exists (
      select 1
      from public.job_suitable_profiles jsp
      where jsp.resume_path = storage.objects.name
        and public.can_view_job_applications(jsp.job_id, auth.uid())
    )
  )
);
