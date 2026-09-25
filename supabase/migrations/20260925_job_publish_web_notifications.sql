-- Immediate job-seeker alerts when an employer or admin publishes a direct portal job.
-- Scraped aggregator imports (Naukri/LinkedIn/etc.) keep source_name/source_url and are skipped.

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
      'new_job'
    )
  );

create table if not exists public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  title text not null,
  preview text,
  link_path text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists job_alerts_created_at_idx
  on public.job_alerts (created_at desc);

alter table public.job_alerts enable row level security;

drop policy if exists "Public can read job alerts" on public.job_alerts;
create policy "Public can read job alerts"
on public.job_alerts
for select
to anon, authenticated
using (true);

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists web_push_subscriptions_user_id_idx
  on public.web_push_subscriptions (user_id)
  where user_id is not null;

drop trigger if exists set_web_push_subscriptions_updated_at on public.web_push_subscriptions;
create trigger set_web_push_subscriptions_updated_at
before update on public.web_push_subscriptions
for each row
execute function public.set_updated_at();

alter table public.web_push_subscriptions enable row level security;

drop policy if exists "Users read own web push subscriptions" on public.web_push_subscriptions;
create policy "Users read own web push subscriptions"
on public.web_push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users insert own web push subscriptions" on public.web_push_subscriptions;
create policy "Users insert own web push subscriptions"
on public.web_push_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users update own web push subscriptions" on public.web_push_subscriptions;
create policy "Users update own web push subscriptions"
on public.web_push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users delete own web push subscriptions" on public.web_push_subscriptions;
create policy "Users delete own web push subscriptions"
on public.web_push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.is_direct_portal_job(
  created_by uuid,
  source_name text,
  source_url text
)
returns boolean
language sql
immutable
as $$
  select
    created_by is not null
    or (
      nullif(btrim(coalesce(source_name, '')), '') is null
      and nullif(btrim(coalesce(source_url, '')), '') is null
    );
$$;

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

  return new;
end;
$$;

drop trigger if exists on_job_published_notify_seekers on public.jobs;
create trigger on_job_published_notify_seekers
after insert or update of status on public.jobs
for each row
execute function public.create_job_publish_notifications();

alter table public.job_alerts replica identity full;
alter table public.reply_notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.job_alerts;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reply_notifications;
exception
  when duplicate_object then null;
end $$;
