-- Site Error Logs: Real-time client bug and crash reports from /api/report-error
create table if not exists public.site_error_logs (
  id uuid primary key default gen_random_uuid(),
  error_message text not null,
  stack_trace text,
  component_stack text,
  context text not null default 'unhandled',
  url text,
  pathname text default '/',
  user_agent text,
  screen_size text,
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'ignored')),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_in_commit text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_site_error_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_site_error_logs_updated_at on public.site_error_logs;
create trigger set_site_error_logs_updated_at
before update on public.site_error_logs
for each row
execute function public.set_site_error_logs_updated_at();

create index if not exists site_error_logs_status_idx on public.site_error_logs (status);
create index if not exists site_error_logs_created_at_idx on public.site_error_logs (created_at desc);
create index if not exists site_error_logs_open_idx on public.site_error_logs (created_at desc) where status = 'open';

alter table public.site_error_logs enable row level security;

-- Anyone can insert error reports (public client crash reporter)
drop policy if exists "Anyone can insert error logs" on public.site_error_logs;
create policy "Anyone can insert error logs"
on public.site_error_logs
for insert
to anon, authenticated
with check (true);

-- Admins can view and update error logs
drop policy if exists "Admins can read site error logs" on public.site_error_logs;
create policy "Admins can read site error logs"
on public.site_error_logs
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can update site error logs" on public.site_error_logs;
create policy "Admins can update site error logs"
on public.site_error_logs
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
