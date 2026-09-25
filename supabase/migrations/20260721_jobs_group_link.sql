-- Optional recruitment group / channel link shown after apply (WhatsApp or Instagram).

alter table public.jobs
  add column if not exists group_link text;

comment on column public.jobs.group_link is
  'Optional WhatsApp/Instagram group URL shown after on-platform apply. Empty = no post-apply group prompt.';
