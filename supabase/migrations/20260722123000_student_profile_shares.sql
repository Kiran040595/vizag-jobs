-- Admin-created shareable student profile cards for companies.
-- Snapshot stores only the fields the admin chose at share time.

create table if not exists public.student_profile_shares (
  id uuid primary key default gen_random_uuid(),
  share_token uuid not null unique default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  company_label text,
  selected_fields text[] not null default '{}'::text[],
  card_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create index if not exists student_profile_shares_student_user_id_idx
  on public.student_profile_shares (student_user_id);

create index if not exists student_profile_shares_created_by_idx
  on public.student_profile_shares (created_by);

create index if not exists student_profile_shares_created_at_idx
  on public.student_profile_shares (created_at desc);

alter table public.student_profile_shares enable row level security;

drop policy if exists "Admins can read student profile shares" on public.student_profile_shares;
create policy "Admins can read student profile shares"
on public.student_profile_shares
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can create student profile shares" on public.student_profile_shares;
create policy "Admins can create student profile shares"
on public.student_profile_shares
for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  and created_by = auth.uid()
);

drop policy if exists "Admins can update student profile shares" on public.student_profile_shares;
create policy "Admins can update student profile shares"
on public.student_profile_shares
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Public lookup by token only — does not expose the table for listing.
create or replace function public.get_student_profile_share(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_token is null then
    return null;
  end if;

  select jsonb_build_object(
    'shareToken', s.share_token,
    'companyLabel', s.company_label,
    'selectedFields', to_jsonb(s.selected_fields),
    'card', s.card_snapshot,
    'createdAt', s.created_at
  )
  into result
  from public.student_profile_shares s
  where s.share_token = p_token
    and s.revoked_at is null;

  return result;
end;
$$;

revoke all on function public.get_student_profile_share(uuid) from public;
grant execute on function public.get_student_profile_share(uuid) to anon, authenticated;
