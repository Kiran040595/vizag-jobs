-- Application inbox: student status changes + employer new applies (bell notifications).
-- Reuses reply_notifications so the existing navbar/employer bell can show counts.

alter table public.reply_notifications
  drop constraint if exists reply_notifications_kind_check;

alter table public.reply_notifications
  add constraint reply_notifications_kind_check
  check (
    kind in (
      'job_question',
      'site_feedback',
      'application_status',
      'new_application'
    )
  );

create or replace function public.application_status_label(status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(status, ''))
    when 'applied' then 'Applied'
    when 'viewed' then 'Viewed'
    when 'processing' then 'Processing'
    when 'hired' then 'Hired'
    when 'rejected' then 'Rejected'
    when 'withdrawn' then 'Withdrawn'
    when 'submitted' then 'Applied'
    when 'shortlisted' then 'Processing'
    else initcap(coalesce(status, 'Updated'))
  end;
$$;

-- Employer: new student application on their job.
create or replace function public.create_employer_new_application_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  employer_id uuid;
  job_title text;
  applicant_name text;
  preview_text text;
begin
  select j.created_by, j.title
  into employer_id, job_title
  from public.jobs j
  where j.id = new.job_id;

  if employer_id is null then
    return new;
  end if;

  -- Never notify the applicant about their own apply as an "employer" event.
  if employer_id = new.student_user_id then
    return new;
  end if;

  applicant_name := nullif(trim(coalesce(new.profile_snapshot->>'fullName', '')), '');
  if applicant_name is null then
    applicant_name := 'A student';
  end if;

  preview_text := applicant_name || ' applied'
    || case
      when nullif(trim(coalesce(new.profile_snapshot->>'college', '')), '') is not null
        then ' · ' || left(trim(new.profile_snapshot->>'college'), 80)
      else ''
    end;

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
    employer_id,
    'new_application',
    new.id,
    'New application for ' || left(coalesce(job_title, 'your job'), 80),
    left(preview_text, 180),
    '/employer/jobs/' || new.job_id::text || '/applications',
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

drop trigger if exists on_job_application_notify_employer on public.job_applications;
create trigger on_job_application_notify_employer
after insert on public.job_applications
for each row
execute function public.create_employer_new_application_notification();

-- Student: application status changed by employer/admin.
create or replace function public.create_student_application_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_title text;
  status_label text;
  preview_text text;
begin
  if new.student_user_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') = coalesce(new.status, '') then
    return new;
  end if;

  -- Initial "applied" is expected; only notify on later status moves.
  if lower(coalesce(new.status, '')) in ('applied', 'submitted') then
    return new;
  end if;

  select j.title into job_title
  from public.jobs j
  where j.id = new.job_id;

  status_label := public.application_status_label(new.status);
  preview_text := 'Status is now ' || status_label
    || case
      when job_title is not null then ' for ' || left(job_title, 80)
      else ''
    end;

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
    new.student_user_id,
    'application_status',
    new.id,
    'Application update: ' || status_label,
    left(preview_text, 180),
    '/student/applied-jobs?application=' || new.id::text,
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

drop trigger if exists on_job_application_status_notify_student on public.job_applications;
create trigger on_job_application_status_notify_student
after update of status on public.job_applications
for each row
execute function public.create_student_application_status_notification();
