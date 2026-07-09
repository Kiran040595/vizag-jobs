create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.jobs_search_document(
  job_title text,
  job_company text,
  job_category text,
  job_type text,
  job_description text,
  job_skills text[]
)
returns tsvector
language sql
immutable
as $$
  select
    setweight(to_tsvector('simple', coalesce(job_title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(job_company, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(job_category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(job_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(job_description, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(job_skills, '{}'), ' ')), 'B');
$$;

create or replace function public.set_job_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document := public.jobs_search_document(
    new.title,
    new.company,
    new.category,
    new.job_type,
    new.description,
    new.skills
  );
  return new;
end;
$$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  company text not null,
  location text not null default 'Visakhapatnam',
  category text not null,
  job_type text not null,
  work_mode text,
  experience text not null default 'Not specified',
  is_fresher boolean not null default false,
  salary text,
  apply_link text,
  short_description text,
  description text,
  responsibilities text[] not null default '{}',
  eligibility text[] not null default '{}',
  warning text,
  posted_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  source_name text,
  source_url text,
  skills text[] not null default '{}',
  company_logo_url text,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  search_document tsvector
);

create trigger set_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

create trigger set_jobs_search_document
before insert or update on public.jobs
for each row
execute function public.set_job_search_document();

update public.jobs
set search_document = public.jobs_search_document(
  title,
  company,
  category,
  job_type,
  description,
  skills
)
where search_document is null;

create index if not exists jobs_status_posted_at_idx
  on public.jobs (status, posted_at desc);

create index if not exists jobs_category_idx
  on public.jobs (category);

create index if not exists jobs_job_type_idx
  on public.jobs (job_type);

create index if not exists jobs_is_fresher_idx
  on public.jobs (is_fresher);

create index if not exists jobs_featured_idx
  on public.jobs (is_featured, posted_at desc);

create index if not exists jobs_search_document_idx
  on public.jobs using gin (search_document);

create index if not exists jobs_title_trgm_idx
  on public.jobs using gin (title gin_trgm_ops);

create index if not exists jobs_company_trgm_idx
  on public.jobs using gin (company gin_trgm_ops);

alter table public.jobs enable row level security;

drop policy if exists "Public can read published jobs" on public.jobs;
create policy "Public can read published jobs"
on public.jobs
for select
to anon, authenticated
using (status = 'published');
