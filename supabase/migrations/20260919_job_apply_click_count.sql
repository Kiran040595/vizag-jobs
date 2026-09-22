-- Unique external-apply clicks (Naukri / LinkedIn / Indeed redirects).
-- Same visitor is stored once per job; logged-in users are keyed by auth.uid().

alter table public.jobs
  add column if not exists apply_click_count integer not null default 0;

comment on column public.jobs.apply_click_count is
  'Unique external Apply clicks (redirects). Separate from on-platform application_count.';

create table if not exists public.job_apply_clicks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  visitor_key text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, visitor_key)
);

create index if not exists job_apply_clicks_job_id_idx on public.job_apply_clicks (job_id);

alter table public.job_apply_clicks enable row level security;

drop policy if exists "Admins read apply clicks" on public.job_apply_clicks;
create policy "Admins read apply clicks"
on public.job_apply_clicks
for select
to authenticated
using (public.is_admin(auth.uid()));

create or replace function public.record_job_apply_click(p_job_id uuid, p_visitor_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text;
  uid uuid;
  inserted integer := 0;
  click_count integer := 0;
begin
  if p_job_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_job');
  end if;

  if not exists (select 1 from public.jobs where id = p_job_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_job');
  end if;

  uid := auth.uid();
  if uid is not null then
    key := 'user:' || uid::text;
  else
    key := lower(btrim(coalesce(p_visitor_key, '')));
    if key !~ '^(user|anon):[a-z0-9-]{8,72}$' then
      return jsonb_build_object('ok', false, 'reason', 'bad_key');
    end if;
  end if;

  insert into public.job_apply_clicks (job_id, visitor_key, user_id)
  values (p_job_id, key, uid)
  on conflict (job_id, visitor_key) do nothing;

  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.jobs
    set apply_click_count = apply_click_count + 1
    where id = p_job_id;
  end if;

  select apply_click_count into click_count
  from public.jobs
  where id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'recorded', inserted > 0,
    'apply_click_count', coalesce(click_count, 0)
  );
end;
$$;

revoke all on public.job_apply_clicks from public;
grant select on public.job_apply_clicks to authenticated;

revoke all on function public.record_job_apply_click(uuid, text) from public;
grant execute on function public.record_job_apply_click(uuid, text) to anon, authenticated;
