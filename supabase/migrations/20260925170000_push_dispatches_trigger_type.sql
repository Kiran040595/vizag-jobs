-- Migration: Ensure push_notification_dispatches & push_notification_opens exist,
-- add trigger_type, backfill from existing job_alerts, and keep dispatches in sync on job publish/approval.

create table if not exists public.push_notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs (id) on delete set null,
  job_slug text,
  title text not null,
  body text,
  link_path text,
  channel text not null default 'web_push',
  status text not null default 'sent',
  trigger_type text default 'auto',
  target_subscribers integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  pruned_count integer not null default 0,
  in_app_recipients integer not null default 0,
  open_count integer not null default 0,
  last_opened_at timestamptz,
  error_detail text,
  triggered_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_notification_dispatches
  add column if not exists trigger_type text default 'auto';

create index if not exists push_notification_dispatches_job_idx
  on public.push_notification_dispatches (job_id, created_at desc);

create index if not exists push_notification_dispatches_created_idx
  on public.push_notification_dispatches (created_at desc);

create index if not exists push_notification_dispatches_trigger_type_idx
  on public.push_notification_dispatches (trigger_type);

alter table public.push_notification_dispatches enable row level security;

drop policy if exists "push_notification_dispatches_admin_select" on public.push_notification_dispatches;
create policy "push_notification_dispatches_admin_select"
  on public.push_notification_dispatches
  for select
  to authenticated
  using (public.is_admin_user());

create table if not exists public.push_notification_opens (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid references public.push_notification_dispatches (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  visitor_key text,
  user_agent text,
  opened_at timestamptz not null default now()
);

create index if not exists push_notification_opens_dispatch_idx
  on public.push_notification_opens (dispatch_id, opened_at desc);

create index if not exists push_notification_opens_job_idx
  on public.push_notification_opens (job_id, opened_at desc);

alter table public.push_notification_opens enable row level security;

drop policy if exists "push_notification_opens_admin_select" on public.push_notification_opens;
create policy "push_notification_opens_admin_select"
  on public.push_notification_opens
  for select
  to authenticated
  using (public.is_admin_user());

drop policy if exists "push_notification_opens_public_insert" on public.push_notification_opens;
create policy "push_notification_opens_public_insert"
  on public.push_notification_opens
  for insert
  to anon, authenticated
  with check (true);

create or replace function public.record_push_notification_open(
  p_dispatch_id uuid default null,
  p_job_id uuid default null,
  p_visitor_key text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispatch_id uuid := p_dispatch_id;
  v_job_id uuid := p_job_id;
begin
  if v_dispatch_id is null and v_job_id is not null then
    select d.id
      into v_dispatch_id
      from public.push_notification_dispatches d
     where d.job_id = v_job_id
     order by d.created_at desc
     limit 1;
  end if;

  if v_job_id is null and v_dispatch_id is not null then
    select d.job_id
      into v_job_id
      from public.push_notification_dispatches d
     where d.id = v_dispatch_id;
  end if;

  if v_dispatch_id is null and v_job_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_reference');
  end if;

  insert into public.push_notification_opens (
    dispatch_id,
    job_id,
    visitor_key,
    user_agent
  )
  values (
    v_dispatch_id,
    v_job_id,
    nullif(trim(coalesce(p_visitor_key, '')), ''),
    left(nullif(trim(coalesce(p_user_agent, '')), ''), 240)
  );

  if v_dispatch_id is not null then
    update public.push_notification_dispatches
       set open_count = coalesce(open_count, 0) + 1,
           last_opened_at = now(),
           updated_at = now()
     where id = v_dispatch_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'dispatch_id', v_dispatch_id,
    'job_id', v_job_id
  );
end;
$$;

grant execute on function public.record_push_notification_open(uuid, uuid, text, text) to anon, authenticated;

-- Update job publish trigger so database-level job approvals also log a dispatch row if one does not exist yet
create or replace function public.create_job_publish_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_should_notify boolean := false;
  v_title text;
  v_preview text;
  v_link text;
  v_trigger_type text;
  v_sub_count integer := 0;
  v_in_app_count integer := 0;
begin
  if tg_op = 'INSERT' then
    v_should_notify := (new.status = 'published');
  elsif tg_op = 'UPDATE' then
    v_should_notify := (coalesce(old.status, '') <> 'published' and new.status = 'published');
  end if;

  if not v_should_notify then
    return new;
  end if;

  v_title := 'New job: ' || coalesce(nullif(trim(new.title), ''), 'Job opening')
    || case
      when coalesce(nullif(trim(new.company), ''), '') <> '' then ' at ' || trim(new.company)
      else ''
    end;

  v_preview := concat_ws(
    ' • ',
    nullif(trim(coalesce(new.location, 'Visakhapatnam')), ''),
    nullif(trim(coalesce(new.qualification, '')), ''),
    nullif(trim(coalesce(new.salary_label, '')), '')
  );
  if coalesce(v_preview, '') = '' then
    v_preview := 'Tap to view eligibility and apply on Vizag Jobs.';
  end if;

  v_link := '/job/' || coalesce(nullif(trim(new.slug), ''), new.id::text);

  insert into public.job_alerts (
    job_id,
    job_slug,
    title,
    company,
    location,
    preview,
    link_path
  )
  values (
    new.id,
    coalesce(nullif(trim(new.slug), ''), new.id::text),
    v_title,
    coalesce(nullif(trim(new.company), ''), 'Vizag Employer'),
    coalesce(nullif(trim(new.location), ''), 'Visakhapatnam'),
    v_preview,
    v_link
  )
  on conflict (job_id) do update
    set job_slug = excluded.job_slug,
        title = excluded.title,
        company = excluded.company,
        location = excluded.location,
        preview = excluded.preview,
        link_path = excluded.link_path,
        created_at = now();

  insert into public.reply_notifications (
    user_id,
    source_type,
    ref_id,
    title,
    preview,
    link_path,
    is_read
  )
  select
    sp.user_id,
    'new_job',
    new.id,
    v_title,
    v_preview,
    v_link,
    false
  from public.student_profiles sp
  where sp.user_id is not null
    and (new.created_by is null or sp.user_id <> new.created_by);

  get diagnostics v_in_app_count = row_count;

  v_trigger_type := case
    when new.created_by is not null or new.reviewed_by is not null then 'auto_employer'
    else 'auto_admin'
  end;

  select count(*)::integer into v_sub_count from public.web_push_subscriptions;

  if not exists (
    select 1
      from public.push_notification_dispatches d
     where d.job_id = new.id
       and d.created_at > now() - interval '2 minutes'
  ) then
    insert into public.push_notification_dispatches (
      job_id,
      job_slug,
      title,
      body,
      link_path,
      channel,
      status,
      trigger_type,
      target_subscribers,
      delivered_count,
      in_app_recipients,
      triggered_by
    )
    values (
      new.id,
      coalesce(nullif(trim(new.slug), ''), new.id::text),
      v_title,
      v_preview,
      v_link,
      'web_push',
      case when v_sub_count > 0 then 'sent' else 'in_app_only' end,
      v_trigger_type,
      v_sub_count,
      v_sub_count,
      v_in_app_count,
      coalesce(new.reviewed_by, new.created_by, 'db_publish_trigger')
    );
  end if;

  return new;
end;
$$;

-- Backfill existing job_alerts into push_notification_dispatches so previously approved jobs appear in analytics
insert into public.push_notification_dispatches (
  job_id,
  job_slug,
  title,
  body,
  link_path,
  channel,
  status,
  trigger_type,
  target_subscribers,
  delivered_count,
  in_app_recipients,
  open_count,
  triggered_by,
  created_at,
  updated_at
)
select
  ja.job_id,
  ja.job_slug,
  ja.title,
  ja.preview,
  ja.link_path,
  'web_push',
  'sent',
  case
    when j.created_by is not null or j.reviewed_by is not null then 'auto_employer'
    else 'auto_admin'
  end as trigger_type,
  (select count(*)::integer from public.web_push_subscriptions wps where wps.created_at <= coalesce(ja.created_at, now()) + interval '1 day'),
  (select count(*)::integer from public.web_push_subscriptions wps where wps.created_at <= coalesce(ja.created_at, now()) + interval '1 day'),
  (select count(*)::integer from public.reply_notifications rn where rn.source_type = 'new_job' and rn.ref_id = ja.job_id),
  (select count(*)::integer from public.reply_notifications rn where rn.source_type = 'new_job' and rn.ref_id = ja.job_id and rn.is_read = true),
  coalesce(j.reviewed_by, j.created_by, 'job_publish_trigger'),
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

