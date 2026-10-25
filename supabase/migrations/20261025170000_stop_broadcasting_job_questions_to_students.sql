-- Stop broadcasting Q&A questions to students who did not ask them.
-- 1. Updates public.create_job_question_reply_notification() to ONLY notify the asking student
--    when their question is answered.
-- 2. Removes broadcast inserts to other job applicants and all registered students.
-- 3. Deletes existing broadcast Q&A spam rows from public.reply_notifications.

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

  -- ONLY notify the question asker (if registered student) that their question was answered.
  -- NEVER broadcast to other students who applied to the job or other registered students.
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
      'Your question was answered: ' || left(job_title, 60),
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

  return new;
end;
$$;

drop trigger if exists on_job_question_reply_notify on public.job_questions;
create trigger on_job_question_reply_notify
after insert or update of answer_body, status on public.job_questions
for each row
execute function public.create_job_question_reply_notification();

-- Clean up existing broadcast Q&A notifications that were sent to students who didn't ask them
delete from public.reply_notifications
where kind = 'job_question'
  and (
    title like 'New Q&A:%'
    or title like 'New Q&A answered for%'
  );
