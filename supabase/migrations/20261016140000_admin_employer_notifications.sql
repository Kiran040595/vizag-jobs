-- Admin notifications for new employer registrations and new employer job postings.
-- Reuses reply_notifications table so the admin bell icon shows live badge count and popup.

-- 1. Ensure kind check constraint includes 'new_employer' and 'new_employer_job'
alter table public.reply_notifications
  drop constraint if exists reply_notifications_kind_check;

alter table public.reply_notifications
  add constraint reply_notifications_kind_check
  check (
    kind in (
      'job_question',
      'site_feedback',
      'application_status',
      'new_application',
      'new_job',
      'new_employer',
      'new_employer_job'
    )
  );

-- 2. Generic helper function to dispatch notifications to all admins
create or replace function public.notify_admins(
  notif_kind text,
  notif_ref_id uuid,
  notif_title text,
  notif_preview text,
  notif_link text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_rec record;
begin
  for admin_rec in select user_id from public.admin_users loop
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
      admin_rec.user_id,
      notif_kind,
      notif_ref_id,
      notif_title,
      notif_preview,
      notif_link,
      false,
      false
    )
    on conflict (user_id, kind, ref_id) do update set
      title = excluded.title,
      preview = excluded.preview,
      link_path = excluded.link_path,
      is_read = false,
      is_dismissed = false,
      created_at = timezone('utc', now());
  end loop;
end;
$$;

grant execute on function public.notify_admins to authenticated, service_role;

-- 3. Trigger when a new employer registers
create or replace function public.notify_admin_on_employer_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emp_name text;
  preview_text text;
  title_text text;
begin
  -- For updates, only fire if initial placeholder company was replaced with real company name
  if tg_op = 'UPDATE' and not (coalesce(old.company_name, '') in ('Your company', '') and coalesce(new.company_name, '') not in ('Your company', '')) then
    return new;
  end if;

  emp_name := coalesce(nullif(trim(new.company_name), ''), 'New employer');
  title_text := 'New employer registered: ' || left(emp_name, 70);

  preview_text := left(
    concat_ws(
      ' · ',
      nullif(trim(coalesce(new.contact_name, '')), ''),
      nullif(trim(coalesce(new.industry, '')), ''),
      nullif(trim(coalesce(new.location, '')), ''),
      nullif(trim(coalesce(new.contact_email, '')), '')
    ),
    180
  );
  if preview_text = '' then
    preview_text := 'A new employer has registered on Vizag Jobs.';
  end if;

  perform public.notify_admins(
    'new_employer',
    new.user_id,
    title_text,
    preview_text,
    '/admin/employers'
  );

  return new;
end;
$$;

drop trigger if exists on_employer_registered_notify_admin on public.employer_profiles;
create trigger on_employer_registered_notify_admin
after insert or update of company_name on public.employer_profiles
for each row
execute function public.notify_admin_on_employer_registration();

-- 4. Trigger when an employer posts a job
create or replace function public.notify_admin_on_employer_job_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_title_text text;
  preview_text text;
  company_label text;
begin
  -- Only notify for jobs with a created_by owner
  if new.created_by is null then
    return new;
  end if;

  -- Skip if job was posted by an admin
  if public.is_admin(new.created_by) then
    return new;
  end if;

  -- For updates, only fire if moving from draft to pending (submitted for review)
  if tg_op = 'UPDATE' and not (coalesce(old.status, '') in ('draft', '') and coalesce(new.status, '') = 'pending') then
    return new;
  end if;

  job_title_text := 'New employer job: ' || left(coalesce(nullif(trim(new.title), ''), 'Untitled opening'), 70);
  company_label := coalesce(nullif(trim(new.company), ''), 'Employer');

  preview_text := left(
    concat_ws(
      ' · ',
      company_label,
      coalesce(nullif(trim(new.location), ''), 'Visakhapatnam'),
      case
        when lower(coalesce(new.status, '')) = 'pending' then 'Pending review'
        when lower(coalesce(new.status, '')) = 'published' then 'Published'
        else initcap(coalesce(new.status, 'Submitted'))
      end
    ),
    180
  );

  perform public.notify_admins(
    'new_employer_job',
    new.id,
    job_title_text,
    preview_text,
    '/admin/jobs'
  );

  return new;
end;
$$;

drop trigger if exists on_employer_job_posted_notify_admin on public.jobs;
create trigger on_employer_job_posted_notify_admin
after insert or update of status on public.jobs
for each row
execute function public.notify_admin_on_employer_job_posted();
