-- Public, denormalized applicant count so listings can show how many
-- students applied without reading job_applications (RLS hides those rows).
-- Same counter for admin-created and employer-created jobs.

alter table public.jobs
  add column if not exists application_count integer not null default 0;

comment on column public.jobs.application_count is
  'Active (non-withdrawn) applications. Maintained by trigger; safe to expose on public job rows.';

create or replace function public.refresh_job_application_count(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_job_id is null then
    return;
  end if;

  update public.jobs
  set application_count = (
    select count(*)::integer
    from public.job_applications
    where job_id = target_job_id
      and status is distinct from 'withdrawn'
  )
  where id = target_job_id;
end;
$$;

create or replace function public.sync_job_application_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_job_application_count(old.job_id);
    return old;
  end if;

  perform public.refresh_job_application_count(new.job_id);

  if tg_op = 'UPDATE' and old.job_id is distinct from new.job_id then
    perform public.refresh_job_application_count(old.job_id);
  end if;

  return new;
end;
$$;

drop trigger if exists job_applications_sync_count on public.job_applications;
create trigger job_applications_sync_count
after insert or delete or update of status, job_id
on public.job_applications
for each row
execute function public.sync_job_application_count();

update public.jobs j
set application_count = coalesce(s.cnt, 0)
from (
  select job_id, count(*)::integer as cnt
  from public.job_applications
  where status is distinct from 'withdrawn'
  group by job_id
) s
where j.id = s.job_id;
