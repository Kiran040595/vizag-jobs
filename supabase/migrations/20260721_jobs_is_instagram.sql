-- Instagram bio landing page: jobs marked is_instagram appear on /ig

alter table public.jobs
  add column if not exists is_instagram boolean not null default false;

create index if not exists jobs_instagram_idx
  on public.jobs (is_instagram, posted_at desc)
  where is_instagram = true;
