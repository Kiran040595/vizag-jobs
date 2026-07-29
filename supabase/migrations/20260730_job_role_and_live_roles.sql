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
  select j.role, count(*)::bigint as usage_count
  from public.jobs j
  where j.status = 'published'
    and j.role is not null
    and trim(j.role) <> ''
  group by j.role
  order by usage_count desc, j.role asc
  limit greatest(1, least(coalesce(limit_count, 60), 200));
$$;

grant execute on function public.distinct_job_roles(integer) to anon, authenticated;
