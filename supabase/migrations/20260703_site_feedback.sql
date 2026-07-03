-- Site feedback: feature requests, problem reports, and general feedback

create table if not exists public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  feedback_type text not null default 'general'
    check (feedback_type in ('feature_request', 'problem', 'general')),
  author_name text,
  author_email text,
  body text not null check (char_length(trim(body)) >= 10),
  page_url text,
  wants_public boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'ignored', 'deleted')),
  admin_reply text,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint site_feedback_author_contact_check
    check (
      nullif(trim(coalesce(author_name, '')), '') is not null
      or nullif(trim(coalesce(author_email, '')), '') is not null
    )
);

create trigger set_site_feedback_updated_at
before update on public.site_feedback
for each row
execute function public.set_updated_at();

create index if not exists site_feedback_status_idx on public.site_feedback (status);
create index if not exists site_feedback_created_at_idx on public.site_feedback (created_at desc);
create index if not exists site_feedback_pending_idx
  on public.site_feedback (created_at desc)
  where status = 'pending';

create table if not exists public.site_feedback_notifications (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.site_feedback (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (feedback_id, user_id)
);

create index if not exists site_feedback_notifications_user_idx
  on public.site_feedback_notifications (user_id, is_read, is_dismissed);

create or replace function public.create_site_feedback_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
begin
  for admin_record in
    select user_id from public.admin_users
  loop
    insert into public.site_feedback_notifications (feedback_id, user_id)
    values (new.id, admin_record.user_id)
    on conflict (feedback_id, user_id) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_site_feedback_created on public.site_feedback;
create trigger on_site_feedback_created
after insert on public.site_feedback
for each row
execute function public.create_site_feedback_notifications();

alter table public.site_feedback enable row level security;
alter table public.site_feedback_notifications enable row level security;

drop policy if exists "Public can read published site feedback" on public.site_feedback;
create policy "Public can read published site feedback"
on public.site_feedback
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Anyone can submit site feedback" on public.site_feedback;
create policy "Anyone can submit site feedback"
on public.site_feedback
for insert
to anon, authenticated
with check (
  status = 'pending'
  and admin_reply is null
  and published_at is null
  and published_by is null
  and (
    nullif(trim(coalesce(author_name, '')), '') is not null
    or nullif(trim(coalesce(author_email, '')), '') is not null
  )
);

drop policy if exists "Admins can read site feedback" on public.site_feedback;
create policy "Admins can read site feedback"
on public.site_feedback
for select
to authenticated
using (
  status <> 'deleted'
  and public.is_admin(auth.uid())
);

drop policy if exists "Admins can update site feedback" on public.site_feedback;
create policy "Admins can update site feedback"
on public.site_feedback
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Users read own site feedback notifications" on public.site_feedback_notifications;
create policy "Users read own site feedback notifications"
on public.site_feedback_notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users update own site feedback notifications" on public.site_feedback_notifications;
create policy "Users update own site feedback notifications"
on public.site_feedback_notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
