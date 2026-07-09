-- Employer profiles and pending job submissions

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = uid
  );
$$;

create table if not exists public.employer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_name text not null,
  contact_name text,
  contact_email text,
  phone text,
  website text,
  company_logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_employer_profiles_updated_at
before update on public.employer_profiles
for each row
execute function public.set_updated_at();

create or replace function public.is_active_employer(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employer_profiles
    where user_id = uid
      and is_active = true
  );
$$;

alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('draft', 'pending', 'published', 'archived'));

alter table public.jobs
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists rejection_reason text;

create index if not exists jobs_created_by_idx on public.jobs (created_by);
create index if not exists jobs_status_pending_idx on public.jobs (status) where status = 'pending';

create or replace function public.handle_new_employer_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_company text;
begin
  signup_company := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');

  insert into public.employer_profiles (user_id, company_name, contact_email)
  values (
    new.id,
    coalesce(signup_company, 'Your company'),
    new.email
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_employer_profile on auth.users;
create trigger on_auth_user_created_employer_profile
after insert on auth.users
for each row
execute function public.handle_new_employer_user();

create or replace function public.enforce_job_submission_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    elsif new.created_by is distinct from auth.uid() then
      raise exception 'You can only submit jobs for your own account.';
    end if;

    new.status := 'pending';
    new.is_featured := false;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.rejection_reason := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.created_by is distinct from auth.uid() then
      raise exception 'You can only edit your own job submissions.';
    end if;

    if old.status not in ('pending', 'draft') then
      raise exception 'Only pending submissions can be edited.';
    end if;

    new.status := 'pending';
    new.is_featured := false;
    new.created_by := old.created_by;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.rejection_reason := null;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_job_submission_rules_insert on public.jobs;
create trigger enforce_job_submission_rules_insert
before insert on public.jobs
for each row
when (not public.is_admin(auth.uid()))
execute function public.enforce_job_submission_rules();

drop trigger if exists enforce_job_submission_rules_update on public.jobs;
create trigger enforce_job_submission_rules_update
before update on public.jobs
for each row
when (not public.is_admin(auth.uid()))
execute function public.enforce_job_submission_rules();

alter table public.employer_profiles enable row level security;

drop policy if exists "Employers can read own profile" on public.employer_profiles;
create policy "Employers can read own profile"
on public.employer_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Employers can insert own profile" on public.employer_profiles;
create policy "Employers can insert own profile"
on public.employer_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Employers can update own profile" on public.employer_profiles;
create policy "Employers can update own profile"
on public.employer_profiles
for update
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Employers can read own jobs" on public.jobs;
create policy "Employers can read own jobs"
on public.jobs
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists "Employers can insert pending jobs" on public.jobs;
create policy "Employers can insert pending jobs"
on public.jobs
for insert
to authenticated
with check (
  public.is_active_employer(auth.uid())
  and created_by = auth.uid()
  and status = 'pending'
  and is_featured = false
);

drop policy if exists "Employers can update own pending jobs" on public.jobs;
create policy "Employers can update own pending jobs"
on public.jobs
for update
to authenticated
using (
  created_by = auth.uid()
  and status in ('pending', 'draft')
)
with check (
  created_by = auth.uid()
  and status in ('pending', 'draft')
  and is_featured = false
);
