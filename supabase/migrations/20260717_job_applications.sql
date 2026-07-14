-- Internal job applications: apply_mode on jobs + applications table + resume storage

alter table public.jobs
  add column if not exists apply_mode text not null default 'external'
    check (apply_mode in ('external', 'internal'));

update public.jobs
set apply_mode = case
  when created_by is not null then 'internal'
  when source_name in ('naukri.com', 'linkedin.com') then 'external'
  when nullif(trim(coalesce(apply_link, '')), '') is not null then 'external'
  else 'internal'
end;

alter table public.student_profiles
  add column if not exists resume_path text;

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  student_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'viewed', 'shortlisted', 'rejected', 'withdrawn')),
  cover_note text,
  resume_path text,
  profile_snapshot jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (job_id, student_user_id)
);

create trigger set_job_applications_updated_at
before update on public.job_applications
for each row
execute function public.set_updated_at();

create index if not exists job_applications_job_id_idx on public.job_applications (job_id);
create index if not exists job_applications_student_user_id_idx on public.job_applications (student_user_id);
create index if not exists job_applications_status_idx on public.job_applications (status);

create or replace function public.job_accepts_internal_applications(job_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    where id = job_uuid
      and status = 'published'
      and apply_mode = 'internal'
  );
$$;

create or replace function public.can_view_job_applications(job_uuid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_moderate_job_questions(job_uuid, uid);
$$;

create or replace function public.student_can_apply_internally(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_profiles sp
    where sp.user_id = uid
      and sp.is_active = true
      and sp.consent_share_with_employers_at is not null
  );
$$;

alter table public.job_applications enable row level security;

drop policy if exists "Students insert own job applications" on public.job_applications;
create policy "Students insert own job applications"
on public.job_applications
for insert
to authenticated
with check (
  student_user_id = auth.uid()
  and status = 'submitted'
  and public.job_accepts_internal_applications(job_id)
  and public.student_can_apply_internally(auth.uid())
);

drop policy if exists "Students read own job applications" on public.job_applications;
create policy "Students read own job applications"
on public.job_applications
for select
to authenticated
using (student_user_id = auth.uid());

drop policy if exists "Students update own job applications" on public.job_applications;
create policy "Students update own job applications"
on public.job_applications
for update
to authenticated
using (student_user_id = auth.uid())
with check (student_user_id = auth.uid());

drop policy if exists "Moderators read job applications" on public.job_applications;
create policy "Moderators read job applications"
on public.job_applications
for select
to authenticated
using (public.can_view_job_applications(job_id, auth.uid()));

drop policy if exists "Moderators update job applications" on public.job_applications;
create policy "Moderators update job applications"
on public.job_applications
for update
to authenticated
using (public.can_view_job_applications(job_id, auth.uid()))
with check (public.can_view_job_applications(job_id, auth.uid()));

drop policy if exists "Admins read all job applications" on public.job_applications;
create policy "Admins read all job applications"
on public.job_applications
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Resume storage bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-resumes',
  'student-resumes',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

drop policy if exists "Students upload own resumes" on storage.objects;
create policy "Students upload own resumes"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Students update own resumes" on storage.objects;
create policy "Students update own resumes"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'student-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Students read own resumes" on storage.objects;
create policy "Students read own resumes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Moderators read application resumes" on storage.objects;
create policy "Moderators read application resumes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-resumes'
  and exists (
    select 1
    from public.job_applications ja
    where ja.resume_path = storage.objects.name
      and public.can_view_job_applications(ja.job_id, auth.uid())
  )
);
