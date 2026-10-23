-- Shared role labels only; never expose student profiles through public suggestions.
begin;

create table public.student_role_catalog (
  role_key text primary key,
  label text not null check (char_length(label) between 1 and 120),
  constraint student_role_catalog_normalized_key check (role_key = lower(label))
);
alter table public.student_role_catalog enable row level security;
revoke all on public.student_role_catalog from public, anon, authenticated;

create or replace function public.capture_student_role_labels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_role_catalog (role_key, label)
  select lower(label), min(label)
  from (
    select left(trim(regexp_replace(value, '\s+', ' ', 'g')), 120) as label
    from unnest(array[new.primary_target_role] || coalesce(new.interested_roles, '{}'::text[])) as roles(value)
  ) cleaned
  where label <> ''
  group by lower(label)
  on conflict (role_key) do nothing;
  return new;
end;
$$;
revoke all on function public.capture_student_role_labels() from public, anon, authenticated;

create trigger capture_student_roles
after insert or update of primary_target_role, interested_roles on public.student_profiles
for each row execute function public.capture_student_role_labels();

-- Existing student roles must also be offered to the next registration.
insert into public.student_role_catalog (role_key, label)
select lower(label), min(label)
from (
  select left(trim(regexp_replace(value, '\s+', ' ', 'g')), 120) as label
  from public.student_profiles p
  cross join lateral unnest(array[p.primary_target_role] || coalesce(p.interested_roles, '{}'::text[])) as roles(value)
) cleaned
where label <> ''
group by lower(label)
on conflict (role_key) do nothing;

create or replace function public.student_role_suggestions(search_text text default '', limit_count integer default 60)
returns table (role text)
language sql
stable
security definer
set search_path = public
as $$
  with labels as (
    select c.label from public.student_role_catalog c
    union all
    select left(trim(regexp_replace(coalesce(public.clean_job_role_label(j.role), public.clean_job_role_label(j.title)), '\s+', ' ', 'g')), 120)
    from public.jobs j where j.status = 'published'
  ), matches as (
    select min(label) as label
    from labels
    where label <> '' and strpos(lower(label), lower(left(trim(regexp_replace(coalesce(search_text, ''), '\s+', ' ', 'g')), 120))) > 0
    group by lower(label)
  )
  select label from matches
  order by lower(label)
  limit greatest(1, least(coalesce(limit_count, 60), 200));
$$;
revoke all on function public.student_role_suggestions(text, integer) from public;
grant execute on function public.student_role_suggestions(text, integer) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
