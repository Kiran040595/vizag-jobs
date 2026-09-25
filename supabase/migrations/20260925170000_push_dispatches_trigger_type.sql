-- Migration: Add trigger_type to push_notification_dispatches for tracking auto vs manual sends
alter table public.push_notification_dispatches
  add column if not exists trigger_type text default 'auto';

create index if not exists push_notification_dispatches_trigger_type_idx
  on public.push_notification_dispatches (trigger_type);
