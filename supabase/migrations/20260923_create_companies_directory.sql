-- Create companies directory table for tracking company websites, careers pages, and auto-scrape settings

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  website text,
  careers_url text,
  category text,
  location text default 'Visakhapatnam',
  is_active_for_scrape boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

alter table public.companies enable row level security;

-- Public can read verified company directory information
drop policy if exists "Public can read companies" on public.companies;
create policy "Public can read companies"
on public.companies
for select
to anon, authenticated
using (true);

-- Admins can insert companies
drop policy if exists "Admins can insert companies" on public.companies;
create policy "Admins can insert companies"
on public.companies
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
  )
);

-- Admins can update companies
drop policy if exists "Admins can update companies" on public.companies;
create policy "Admins can update companies"
on public.companies
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

-- Admins can delete companies
drop policy if exists "Admins can delete companies" on public.companies;
create policy "Admins can delete companies"
on public.companies
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
  )
);
