-- Stable share tokens so admin Excel exports can include lasting resume links for companies.

alter table public.job_applications
  add column if not exists resume_share_token uuid;

update public.job_applications
set resume_share_token = gen_random_uuid()
where resume_share_token is null;

alter table public.job_applications
  alter column resume_share_token set default gen_random_uuid();

alter table public.job_applications
  alter column resume_share_token set not null;

create unique index if not exists job_applications_resume_share_token_uidx
  on public.job_applications (resume_share_token);
