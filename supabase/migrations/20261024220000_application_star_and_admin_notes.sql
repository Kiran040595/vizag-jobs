-- Migration: 20261024220000_application_star_and_admin_notes.sql
-- Adds is_starred, starred_at, and admin_notes to job_applications
-- Adds is_starred to job_suitable_profiles
-- Enables admin curation/starring and referral highlighting visible to employers

-- 1. Extend job_applications
alter table public.job_applications
  add column if not exists is_starred boolean not null default false,
  add column if not exists starred_at timestamptz,
  add column if not exists admin_notes text;

comment on column public.job_applications.is_starred is
  'Flag set by platform admin to highlight/refer important candidates for this job.';

comment on column public.job_applications.admin_notes is
  'Recommendation note written by admin explaining why this candidate is referred to the company.';

create index if not exists idx_job_applications_starred
  on public.job_applications(job_id, is_starred)
  where is_starred = true;

-- 3. Policy to allow admins to update star and admin notes on job_applications
drop policy if exists "Admins update job applications" on public.job_applications;
create policy "Admins update job applications"
  on public.job_applications
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
