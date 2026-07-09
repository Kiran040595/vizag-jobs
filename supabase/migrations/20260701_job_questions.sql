-- Job Q&A: visitor questions with admin/employer moderation

create table if not exists public.job_questions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  asker_name text,
  asker_email text,
  body text not null check (char_length(trim(body)) >= 3),
  status text not null default 'pending'
    check (status in ('pending', 'published', 'ignored', 'deleted')),
  answer_body text,
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint job_questions_asker_contact_check
    check (
      nullif(trim(coalesce(asker_name, '')), '') is not null
      or nullif(trim(coalesce(asker_email, '')), '') is not null
    )
);

create trigger set_job_questions_updated_at
before update on public.job_questions
for each row
execute function public.set_updated_at();

create index if not exists job_questions_job_id_idx on public.job_questions (job_id);
create index if not exists job_questions_status_idx on public.job_questions (status);
create index if not exists job_questions_pending_idx
  on public.job_questions (job_id, status)
  where status = 'pending';

create table if not exists public.job_question_notifications (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.job_questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (question_id, user_id)
);

create index if not exists job_question_notifications_user_inbox_idx
  on public.job_question_notifications (user_id, is_read, is_dismissed);

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

create or replace function public.can_moderate_job_questions(job_uuid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(uid)
    or exists (
      select 1
      from public.jobs j
      where j.id = job_uuid
        and j.created_by = uid
    );
$$;

create or replace function public.create_job_question_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
  job_owner_id uuid;
begin
  select created_by into job_owner_id
  from public.jobs
  where id = new.job_id;

  for admin_record in
    select user_id from public.admin_users
  loop
    insert into public.job_question_notifications (question_id, user_id)
    values (new.id, admin_record.user_id)
    on conflict (question_id, user_id) do nothing;
  end loop;

  if job_owner_id is not null then
    insert into public.job_question_notifications (question_id, user_id)
    values (new.id, job_owner_id)
    on conflict (question_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_job_question_created on public.job_questions;
create trigger on_job_question_created
after insert on public.job_questions
for each row
execute function public.create_job_question_notifications();

alter table public.job_questions enable row level security;
alter table public.job_question_notifications enable row level security;

drop policy if exists "Public can read published job questions" on public.job_questions;
create policy "Public can read published job questions"
on public.job_questions
for select
to anon, authenticated
using (
  status = 'published'
  and public.is_published_job(job_id)
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
  and public.is_published_job(job_id)
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

drop policy if exists "Users read own question notifications" on public.job_question_notifications;
create policy "Users read own question notifications"
on public.job_question_notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users update own question notifications" on public.job_question_notifications;
create policy "Users update own question notifications"
on public.job_question_notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
