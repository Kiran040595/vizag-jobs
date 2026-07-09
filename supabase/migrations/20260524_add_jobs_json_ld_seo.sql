-- Persist Gemini JobPosting JSON-LD and SEO extras on published jobs

alter table public.jobs
  add column if not exists json_ld jsonb,
  add column if not exists seo_meta jsonb;

create index if not exists jobs_with_json_ld_idx
  on public.jobs ((json_ld is not null))
  where json_ld is not null;
