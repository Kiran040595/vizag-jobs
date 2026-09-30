-- Push Notifications Dashboard: Dispatches, Opens tracking, and Admin Policies

-- 1. Table to record push notification dispatch batches
create table if not exists public.push_notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs (id) on delete set null,
  title text not null,
  body text,
  url text,
  tag text,
  is_test boolean not null default false,
  sent_by uuid references auth.users (id) on delete set null,
  target_subscribers integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  open_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists push_notification_dispatches_created_at_idx
  on public.push_notification_dispatches (created_at desc);

create index if not exists push_notification_dispatches_job_id_idx
  on public.push_notification_dispatches (job_id);

alter table public.push_notification_dispatches enable row level security;

-- 2. Table to record individual notification open / click events
create table if not exists public.push_notification_opens (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid references public.push_notification_dispatches (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  visitor_key text not null,
  user_agent text,
  opened_at timestamptz not null default timezone('utc', now()),
  unique (dispatch_id, visitor_key)
);

create index if not exists push_notification_opens_dispatch_id_idx
  on public.push_notification_opens (dispatch_id);

create index if not exists push_notification_opens_opened_at_idx
  on public.push_notification_opens (opened_at desc);

alter table public.push_notification_opens enable row level security;

-- 3. RLS Policies
-- Allow admins full read access to dispatches
drop policy if exists "Admins read push dispatches" on public.push_notification_dispatches;
create policy "Admins read push dispatches"
on public.push_notification_dispatches
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Allow admins to insert / update dispatches
drop policy if exists "Admins manage push dispatches" on public.push_notification_dispatches;
create policy "Admins manage push dispatches"
on public.push_notification_dispatches
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Allow admins read access to opens
drop policy if exists "Admins read push opens" on public.push_notification_opens;
create policy "Admins read push opens"
on public.push_notification_opens
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Allow admins to read all subscriptions from web_push_subscriptions table
drop policy if exists "Admins read all web push subscriptions" on public.web_push_subscriptions;
create policy "Admins read all web push subscriptions"
on public.web_push_subscriptions
for select
to authenticated
using (public.is_admin(auth.uid()));

-- 4. RPC to securely record notification open/click from client or service worker
create or replace function public.record_push_notification_open(
  p_dispatch_id uuid,
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
  v_key text;
  v_dispatch_id uuid := p_dispatch_id;
  v_job_id uuid := p_job_id;
  v_inserted integer := 0;
begin
  if v_dispatch_id is null and v_job_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_identifiers');
  end if;

  -- If dispatch_id not provided, try to find the latest dispatch for this job
  if v_dispatch_id is null and v_job_id is not null then
    select id into v_dispatch_id
    from public.push_notification_dispatches
    where job_id = v_job_id
    order by created_at desc
    limit 1;
  end if;

  -- Build or sanitize visitor key
  if auth.uid() is not null then
    v_key := 'user:' || auth.uid()::text;
  else
    v_key := lower(btrim(coalesce(p_visitor_key, '')));
    if v_key = '' or length(v_key) < 6 then
      v_key := 'anon:' || md5(coalesce(p_user_agent, '') || clock_timestamp()::text);
    end if;
  end if;

  if v_dispatch_id is not null then
    insert into public.push_notification_opens (dispatch_id, job_id, visitor_key, user_agent)
    values (v_dispatch_id, v_job_id, v_key, left(coalesce(p_user_agent, ''), 240))
    on conflict (dispatch_id, visitor_key) do nothing;

    get diagnostics v_inserted = row_count;

    if v_inserted > 0 then
      update public.push_notification_dispatches
      set open_count = open_count + 1,
          updated_at = timezone('utc', now())
      where id = v_dispatch_id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'recorded', v_inserted > 0,
    'dispatch_id', v_dispatch_id
  );
end;
$$;

revoke all on function public.record_push_notification_open(uuid, uuid, text, text) from public;
grant execute on function public.record_push_notification_open(uuid, uuid, text, text) to anon, authenticated;
