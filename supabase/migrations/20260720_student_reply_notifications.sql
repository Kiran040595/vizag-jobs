-- Link askers/authors to auth users and create student inbox notifications on reply.

alter table public.job_questions
  add column if not exists asker_user_id uuid references auth.users (id) on delete set null;

alter table public.site_feedback
  add column if not exists author_user_id uuid references auth.users (id) on delete set null;

create index if not exists job_questions_asker_user_id_idx
  on public.job_questions (asker_user_id)
  where asker_user_id is not null;

create index if not exists site_feedback_author_user_id_idx
  on public.site_feedback (author_user_id)
  where author_user_id is not null;

create table if not exists public.reply_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('job_question', 'site_feedback')),
  ref_id uuid not null,
  title text not null default 'You have a reply',
  preview text,
  link_path text not null,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, kind, ref_id)
);

create index if not exists reply_notifications_user_inbox_idx
  on public.reply_notifications (user_id, is_read, is_dismissed, created_at desc);

alter table public.reply_notifications enable row level security;

drop policy if exists "Users read own reply notifications" on public.reply_notifications;
create policy "Users read own reply notifications"
on public.reply_notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users update own reply notifications" on public.reply_notifications;
create policy "Users update own reply notifications"
on public.reply_notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Allow authenticated askers to attach their own user id on insert.
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
  and (
    asker_user_id is null
    or asker_user_id = auth.uid()
  )
);

drop policy if exists "Anyone can submit site feedback" on public.site_feedback;
create policy "Anyone can submit site feedback"
on public.site_feedback
for insert
to anon, authenticated
with check (
  status = 'pending'
  and admin_reply is null
  and published_at is null
  and published_by is null
  and (
    nullif(trim(coalesce(author_name, '')), '') is not null
    or nullif(trim(coalesce(author_email, '')), '') is not null
  )
  and (
    author_user_id is null
    or author_user_id = auth.uid()
  )
);

-- Students can read their own submitted feedback (including with replies).
drop policy if exists "Authors can read own site feedback" on public.site_feedback;
create policy "Authors can read own site feedback"
on public.site_feedback
for select
to authenticated
using (
  author_user_id = auth.uid()
  and status <> 'deleted'
);

create or replace function public.create_job_question_reply_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_slug text;
  link text;
  answer_text text;
begin
  if new.asker_user_id is null then
    return new;
  end if;

  answer_text := nullif(trim(coalesce(new.answer_body, '')), '');
  if answer_text is null then
    return new;
  end if;

  if new.status <> 'published' then
    return new;
  end if;

  -- Notify when newly published with an answer, or when answer changes while published.
  if tg_op = 'UPDATE'
    and old.status = 'published'
    and coalesce(old.answer_body, '') = coalesce(new.answer_body, '')
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status <> 'published'
    and new.status = 'published'
    and answer_text is null
  then
    return new;
  end if;

  select slug into job_slug
  from public.jobs
  where id = new.job_id;

  if job_slug is null then
    return new;
  end if;

  -- Single-segment job URL redirects to the canonical path in middleware.
  link := '/jobs/' || job_slug || '?question=' || new.id::text;

  insert into public.reply_notifications (user_id, kind, ref_id, title, preview, link_path, is_read, is_dismissed)
  values (
    new.asker_user_id,
    'job_question',
    new.id,
    'Reply to your job question',
    left(answer_text, 180),
    link,
    false,
    false
  )
  on conflict (user_id, kind, ref_id) do update
    set
      title = excluded.title,
      preview = excluded.preview,
      link_path = excluded.link_path,
      is_read = false,
      is_dismissed = false,
      created_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_job_question_reply_notify on public.job_questions;
create trigger on_job_question_reply_notify
after update of answer_body, status on public.job_questions
for each row
execute function public.create_job_question_reply_notification();

create or replace function public.create_site_feedback_reply_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reply_text text;
begin
  if new.author_user_id is null then
    return new;
  end if;

  reply_text := nullif(trim(coalesce(new.admin_reply, '')), '');
  if reply_text is null then
    return new;
  end if;

  if new.status <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'published'
    and coalesce(old.admin_reply, '') = coalesce(new.admin_reply, '')
  then
    return new;
  end if;

  insert into public.reply_notifications (user_id, kind, ref_id, title, preview, link_path, is_read, is_dismissed)
  values (
    new.author_user_id,
    'site_feedback',
    new.id,
    'Reply to your feedback',
    left(reply_text, 180),
    '/feedback?feedback=' || new.id::text,
    false,
    false
  )
  on conflict (user_id, kind, ref_id) do update
    set
      title = excluded.title,
      preview = excluded.preview,
      link_path = excluded.link_path,
      is_read = false,
      is_dismissed = false,
      created_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_site_feedback_reply_notify on public.site_feedback;
create trigger on_site_feedback_reply_notify
after update of admin_reply, status on public.site_feedback
for each row
execute function public.create_site_feedback_reply_notification();
