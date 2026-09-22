-- Community Q&A Enhancements:
-- 1. Allow general questions (nullable job_id)
-- 2. Add category and helpful_count
-- 3. Add RPC for helpful votes
-- 4. Update RLS policies to allow reading/moderating general questions

alter table public.job_questions alter column job_id drop not null;

alter table public.job_questions
  add column if not exists category text default 'general',
  add column if not exists helpful_count integer not null default 0;

create or replace function public.can_moderate_job_questions(job_uuid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(uid)
    or (
      job_uuid is not null
      and exists (
        select 1
        from public.jobs j
        where j.id = job_uuid
          and j.created_by = uid
      )
    );
$$;

drop policy if exists "Public can read published job questions" on public.job_questions;
create policy "Public can read published job questions"
on public.job_questions
for select
to anon, authenticated
using (
  status = 'published'
  and (job_id is null or public.is_published_job(job_id))
);

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
  and (job_id is null or public.is_published_job(job_id))
  and (
    nullif(trim(coalesce(asker_name, '')), '') is not null
    or nullif(trim(coalesce(asker_email, '')), '') is not null
  )
);

drop policy if exists "Moderators can read job questions" on public.job_questions;
create policy "Moderators can read job questions"
on public.job_questions
for select
to authenticated
using (
  status <> 'deleted'
  and public.can_moderate_job_questions(job_id, auth.uid())
);

drop policy if exists "Moderators can update job questions" on public.job_questions;
create policy "Moderators can update job questions"
on public.job_questions
for update
to authenticated
using (public.can_moderate_job_questions(job_id, auth.uid()))
with check (public.can_moderate_job_questions(job_id, auth.uid()));

create or replace function public.increment_question_helpful(question_uuid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.job_questions
  set helpful_count = coalesce(helpful_count, 0) + 1
  where id = question_uuid and status = 'published'
  returning helpful_count into updated_count;

  return coalesce(updated_count, 0);
end;
$$;

grant execute on function public.increment_question_helpful(uuid) to anon, authenticated;
