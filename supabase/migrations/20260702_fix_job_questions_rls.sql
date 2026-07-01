-- Fix job question inserts: security-definer job check + avoid RETURNING RLS failures

create or replace function public.is_published_job(job_uuid uuid)
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
  );
$$;

drop policy if exists "Anyone can ask job questions" on public.job_questions;
create policy "Anyone can ask job questions"
on public.job_questions
for insert
to anon, authenticated
with check (
  status = 'pending'
  and answer_body is null
  and answered_by is null
  and published_at is null
  and published_by is null
  and public.is_published_job(job_id)
  and (
    nullif(trim(coalesce(asker_name, '')), '') is not null
    or nullif(trim(coalesce(asker_email, '')), '') is not null
  )
);

drop policy if exists "Public can read published job questions" on public.job_questions;
create policy "Public can read published job questions"
on public.job_questions
for select
to anon, authenticated
using (
  status = 'published'
  and public.is_published_job(job_id)
);
