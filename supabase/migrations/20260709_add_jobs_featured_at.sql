-- Track when a job was marked featured so public listings can show the
-- most recently featured jobs first among featured rows.

alter table public.jobs
  add column if not exists featured_at timestamptz;

update public.jobs
set featured_at = coalesce(updated_at, posted_at, created_at)
where is_featured = true
  and featured_at is null;

create index if not exists jobs_featured_at_idx
  on public.jobs (is_featured desc, featured_at desc nulls last, posted_at desc)
  where status = 'published';
