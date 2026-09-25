-- Server-only Web Push VAPID material. No policies: service role only.

create table if not exists public.web_push_config (
  id integer primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  subject text not null default 'mailto:kkumardadi@gmail.com',
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.web_push_config enable row level security;

revoke all on table public.web_push_config from anon, authenticated;
