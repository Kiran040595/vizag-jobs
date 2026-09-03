-- Job retention (free-tier DB size) + student profiles

-- ---------------------------------------------------------------------------
-- Job archive / purge (callable from cron script via service role)
-- ---------------------------------------------------------------------------

create or replace function public.archive_stale_jobs(archive_after_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.jobs
  set
    status = 'archived',
    description = null,
    short_description = null,
    json_ld = null,
    seo_meta = null,
    responsibilities = '{}',
    eligibility = '{}',
    warning = coalesce(warning, 'Archived automatically after ' || archive_after_days || ' days.')
  where status = 'published'
    and posted_at < timezone('utc', now()) - make_interval(days => archive_after_days);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.purge_archived_jobs(purge_after_days integer default 180)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  delete from public.jobs
  where status = 'archived'
    and posted_at < timezone('utc', now()) - make_interval(days => purge_after_days);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.archive_stale_jobs(integer) from public;
revoke all on function public.purge_archived_jobs(integer) from public;
grant execute on function public.archive_stale_jobs(integer) to service_role;
grant execute on function public.purge_archived_jobs(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Student profiles
-- ---------------------------------------------------------------------------

create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  college text,
  degree text,
  branch text,
  graduation_year smallint,
  contact_email text,
  phone text,
  skills text[] not null default '{}',
  is_fresher boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_student_profiles_updated_at
before update on public.student_profiles
for each row
execute function public.set_updated_at();

create index if not exists student_profiles_college_idx on public.student_profiles (college);
create index if not exists student_profiles_created_at_idx on public.student_profiles (created_at desc);

create or replace function public.is_active_student(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_profiles
    where user_id = uid
      and is_active = true
  );
$$;

-- Route new auth users to student or employer profile based on signup metadata.
create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_type text;
  signup_company text;
  signup_name text;
  signup_college text;
begin
  user_type := lower(trim(coalesce(new.raw_user_meta_data ->> 'user_type', 'employer')));
  signup_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  signup_college := nullif(trim(coalesce(new.raw_user_meta_data ->> 'college', '')), '');

  if user_type = 'student' then
    insert into public.student_profiles (user_id, full_name, college, contact_email)
    values (
      new.id,
      coalesce(signup_name, 'Your name'),
      signup_college,
      new.email
    )
    on conflict (user_id) do nothing;
  else
    signup_company := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
    insert into public.employer_profiles (user_id, company_name, contact_email)
    values (
      new.id,
      coalesce(signup_company, 'Your company'),
      new.email
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_employer_profile on auth.users;
drop trigger if exists on_auth_user_created_user_profile on auth.users;
create trigger on_auth_user_created_user_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_profile();

alter table public.student_profiles enable row level security;

drop policy if exists "Students can read own profile" on public.student_profiles;
create policy "Students can read own profile"
on public.student_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Students can insert own profile" on public.student_profiles;
create policy "Students can insert own profile"
on public.student_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Students can update own profile" on public.student_profiles;
create policy "Students can update own profile"
on public.student_profiles
for update
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));
