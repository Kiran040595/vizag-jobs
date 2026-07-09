create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_users enable row level security;

drop policy if exists "Users can read their admin membership" on public.admin_users;
create policy "Users can read their admin membership"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all jobs" on public.jobs;
create policy "Admins can read all jobs"
on public.jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
  )
);

drop policy if exists "Admins can insert jobs" on public.jobs;
create policy "Admins can insert jobs"
on public.jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
  )
);

drop policy if exists "Admins can update jobs" on public.jobs;
create policy "Admins can update jobs"
on public.jobs
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
  )
);
