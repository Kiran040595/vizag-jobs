-- Auto-publish job questions with Gemini answers and notify students.
-- 1. Updates trigger to run on INSERT OR UPDATE of status and answer_body on public.job_questions.
-- 2. Notifies the asking student in reply_notifications.
-- 3. Notifies students who applied to the job (job_applications.student_user_id).
-- 4. Notifies registered students (student_profiles.user_id).
-- 5. Handles both job-specific questions and community career questions (nullable job_id).

create or replace function public.create_job_question_reply_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_record record;
  job_title text;
  job_slug text;
  link text;
  answer_text text;
begin
  answer_text := nullif(trim(coalesce(new.answer_body, '')), '');
  if answer_text is null then
    return new;
  end if;

  if new.status <> 'published' then
    return new;
  end if;

  -- Skip redundant updates if answer and status did not change
  if tg_op = 'UPDATE'
    and old.status = 'published'
    and coalesce(old.answer_body, '') = coalesce(new.answer_body, '')
  then
    return new;
  end if;

  -- Resolve job details and notification target link
  if new.job_id is not null then
    select id, slug, title into job_record
    from public.jobs
    where id = new.job_id;

    job_title := coalesce(job_record.title, 'Job');
    job_slug := coalesce(job_record.slug, new.job_id::text);
    link := '/job/' || job_slug || '?question=' || new.id::text;
  else
    job_title := 'Vizag Job & Career Doubt';
    link := '/community-qa?question=' || new.id::text;
  end if;

  -- 1. Notify the question asker (if registered student)
  if new.asker_user_id is not null then
    insert into public.reply_notifications (
      user_id,
      kind,
      ref_id,
      title,
      preview,
      link_path,
      is_read,
      is_dismissed
    )
    values (
      new.asker_user_id,
      'job_question',
      new.id,
      'Gemini answered your question: ' || left(job_title, 60),
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
  end if;

  -- 2. Notify students who applied to this specific job
  if new.job_id is not null then
    insert into public.reply_notifications (
      user_id,
      kind,
      ref_id,
      title,
      preview,
      link_path,
      is_read,
      is_dismissed
    )
    select
      ja.student_user_id,
      'job_question',
      new.id,
      'New Q&A answered for ' || left(job_title, 60),
      left('Q: ' || new.body || ' · A: ' || answer_text, 180),
      link,
      false,
      false
    from public.job_applications ja
    where ja.job_id = new.job_id
      and (new.asker_user_id is null or ja.student_user_id <> new.asker_user_id)
    on conflict (user_id, kind, ref_id) do nothing;
  end if;

  -- 3. Notify registered students in student_profiles
  insert into public.reply_notifications (
    user_id,
    kind,
    ref_id,
    title,
    preview,
    link_path,
    is_read,
    is_dismissed
  )
  select
    sp.user_id,
    'job_question',
    new.id,
    'New Q&A: ' || left(job_title, 60),
    left('Q: ' || new.body || ' · A: ' || answer_text, 180),
    link,
    false,
    false
  from public.student_profiles sp
  where sp.user_id is not null
    and (new.asker_user_id is null or sp.user_id <> new.asker_user_id)
  on conflict (user_id, kind, ref_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_job_question_reply_notify on public.job_questions;
create trigger on_job_question_reply_notify
after insert or update of answer_body, status on public.job_questions
for each row
execute function public.create_job_question_reply_notification();
