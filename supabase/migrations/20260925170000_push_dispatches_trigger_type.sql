-- Migration: Add trigger_type to push_notification_dispatches, backfill existing job_alerts,
-- and record dispatches when jobs transition to published.

alter table public.push_notification_dispatches
  add column if not exists trigger_type text default 'auto';

create index if not exists push_notification_dispatches_trigger_type_idx
  on public.push_notification_dispatches (trigger_type);

-- Update job publish trigger so database-level job approvals also log a dispatch row if one does not exist yet
create or replace function public.create_job_publish_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_title text;
  alert_preview text;
  alert_path text;
  inserted_alert_id uuid;
  v_trigger_type text;
  v_sub_count integer := 0;
begin
  if tg_op = 'UPDATE' and new.status is distinct from 'published' then
    delete from public.job_alerts where job_id = new.id;
    return new;
  end if;

  if new.status is distinct from 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') = 'published' then
    return new;
  end if;

  if not public.is_direct_portal_job(new.created_by, new.source_name, new.source_url) then
    return new;
  end if;

  alert_title := 'New job: ' || left(coalesce(nullif(btrim(new.title), ''), 'Vizag opening'), 80);
  alert_preview := left(
    concat_ws(
      ' · ',
      nullif(btrim(coalesce(new.company, '')), ''),
      coalesce(nullif(btrim(coalesce(new.location, '')), ''), 'Visakhapatnam')
    ),
    180
  );
  alert_path := '/job/' || coalesce(nullif(btrim(new.slug), ''), new.id::text);

  insert into public.job_alerts (job_id, title, preview, link_path)
  values (new.id, alert_title, alert_preview, alert_path)
  on conflict (job_id) do nothing
  returning id into inserted_alert_id;

  if inserted_alert_id is null then
    return new;
  end if;

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
    'new_job',
    new.id,
    alert_title,
    alert_preview,
    alert_path,
    false,
    false
  from public.student_profiles sp
  where sp.user_id is not null
    and (new.created_by is null or sp.user_id <> new.created_by)
  on conflict (user_id, kind, ref_id) do update
    set
      title = excluded.title,
      preview = excluded.preview,
      link_path = excluded.link_path,
      is_read = false,
      is_dismissed = false,
      created_at = timezone('utc', now());

  v_trigger_type := case
    when new.created_by is not null or new.reviewed_by is not null then 'auto_employer'
    else 'auto_admin'
  end;

  select count(*)::integer into v_sub_count from public.web_push_subscriptions;

  if not exists (
    select 1
      from public.push_notification_dispatches d
     where d.job_id = new.id
       and d.created_at > timezone('utc', now()) - interval '2 minutes'
  ) then
    insert into public.push_notification_dispatches (
      job_id,
      title,
      body,
      url,
      tag,
      is_test,
      sent_by,
      target_subscribers,
      sent_count,
      failed_count,
      open_count,
      trigger_type
    )
    values (
      new.id,
      alert_title,
      alert_preview,
      alert_path,
      'job-alert-' || new.id::text || '__' || v_trigger_type,
      false,
      coalesce(new.reviewed_by, new.created_by),
      v_sub_count,
      v_sub_count,
      0,
      0,
      v_trigger_type
    );
  end if;

  return new;
end;
$$;

-- Backfill existing job_alerts into push_notification_dispatches so previously approved jobs appear in analytics
insert into public.push_notification_dispatches (
  job_id,
  title,
  body,
  url,
  tag,
  is_test,
  sent_by,
  target_subscribers,
  sent_count,
  failed_count,
  open_count,
  trigger_type,
  created_at,
  updated_at
)
select
  ja.job_id,
  ja.title,
  ja.preview,
  ja.link_path,
  'job-alert-' || ja.job_id::text || '__' || (
    case
      when j.created_by is not null or j.reviewed_by is not null then 'auto_employer'
      else 'auto_admin'
    end
  ),
  false,
  coalesce(j.reviewed_by, j.created_by),
  (select count(*)::integer from public.web_push_subscriptions wps where wps.created_at <= coalesce(ja.created_at, now()) + interval '1 day'),
  (select count(*)::integer from public.web_push_subscriptions wps where wps.created_at <= coalesce(ja.created_at, now()) + interval '1 day'),
  0,
  (select count(*)::integer from public.reply_notifications rn where rn.kind = 'new_job' and rn.ref_id::text = ja.job_id::text and rn.is_read = true),
  case
    when j.created_by is not null or j.reviewed_by is not null then 'auto_employer'
    else 'auto_admin'
  end as trigger_type,
  ja.created_at,
  ja.created_at
from public.job_alerts ja
left join public.jobs j on j.id = ja.job_id
where ja.job_id is not null
  and not exists (
    select 1
      from public.push_notification_dispatches d
     where d.job_id = ja.job_id
  );



