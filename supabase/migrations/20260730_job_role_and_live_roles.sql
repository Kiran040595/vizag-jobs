-- Dedicated job role for student targeting + live role picker at registration.

alter table public.jobs
  add column if not exists role text;

update public.jobs
set role = title
where role is null
  and title is not null
  and trim(title) <> '';

create index if not exists jobs_role_idx on public.jobs (lower(role));

create or replace function public.distinct_job_roles(limit_count integer default 60)
returns table (role text, usage_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select cleaned.role, count(*)::bigint as usage_count
  from (
    select coalesce(
      public.clean_job_role_label(j.role),
      public.clean_job_role_label(j.title),
      nullif(trim(j.role), ''),
      nullif(trim(j.title), '')
    ) as role
    from public.jobs j
    where j.status = 'published'
  ) cleaned
  where cleaned.role is not null
    and trim(cleaned.role) <> ''
    and char_length(cleaned.role) <= 56
  group by cleaned.role
  order by usage_count desc, cleaned.role asc
  limit greatest(1, least(coalesce(limit_count, 60), 200));
$$;

grant execute on function public.distinct_job_roles(integer) to anon, authenticated;
