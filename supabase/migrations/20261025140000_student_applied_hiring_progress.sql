-- Migration: Add secure functions for applied students to track job hiring progress
-- Conditions:
-- 1. Total applications for the job > 50
-- 2. Admin or employer has taken action (changed the status of at least one application)
-- If unlocked, aggregate counts (total, viewed, shortlisted, interviews, hiring stage) are returned.
-- Otherwise, metrics remain private (null).

-- 1. Batch function for all jobs applied by the signed-in student
create or replace function public.get_my_applied_jobs_hiring_progress()
returns table (
  job_id uuid,
  unlocked boolean,
  total_applications integer,
  viewed_count integer,
  shortlisted_count integer,
  interview_scheduled_count integer,
  hired_count integer,
  hiring_stage text,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    return;
  end if;

  return query
  with my_jobs as (
    select distinct ja.job_id
    from public.job_applications ja
    where ja.student_user_id = v_student_id
      and ja.status != 'withdrawn'
  ),
  job_stats as (
    select
      ja.job_id,
      count(*)::integer as total_apps,
      count(*) filter (where ja.status in ('viewed', 'screened', 'interview_scheduled', 'processing', 'hired', 'joined', 'rejected'))::integer as viewed_apps,
      count(*) filter (where ja.status in ('screened', 'processing'))::integer as shortlisted_apps,
      count(*) filter (where ja.status = 'interview_scheduled')::integer as interview_apps,
      count(*) filter (where ja.status in ('hired', 'joined'))::integer as hired_apps,
      bool_or(ja.status != 'applied') as has_status_action,
      max(ja.updated_at) as latest_update
    from public.job_applications ja
    where ja.job_id in (select mj.job_id from my_jobs mj)
      and ja.status != 'withdrawn'
    group by ja.job_id
  )
  select
    js.job_id,
    (js.total_apps > 50 and coalesce(js.has_status_action, false)) as unlocked,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.total_apps else null end as total_applications,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.viewed_apps else null end as viewed_count,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.shortlisted_apps else null end as shortlisted_count,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.interview_apps else null end as interview_scheduled_count,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.hired_apps else null end as hired_count,
    case
      when not (js.total_apps > 50 and coalesce(js.has_status_action, false)) then null
      when js.hired_apps > 0 then 'hiring_completed'
      when js.interview_apps > 0 then 'interviewing'
      when js.shortlisted_apps > 0 then 'shortlisting'
      when js.viewed_apps > 0 then 'reviewing'
      else 'actively_hiring'
    end as hiring_stage,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.latest_update else null end as last_activity_at
  from job_stats js;
end;
$$;

grant execute on function public.get_my_applied_jobs_hiring_progress() to authenticated;

-- 2. Single-job function for the job details page
create or replace function public.get_job_hiring_progress(p_job_id uuid)
returns table (
  job_id uuid,
  unlocked boolean,
  total_applications integer,
  viewed_count integer,
  shortlisted_count integer,
  interview_scheduled_count integer,
  hired_count integer,
  hiring_stage text,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_authorized boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  -- Verify user has applied for this job, or is an admin/employer
  if public.is_admin(v_user_id) or public.can_view_job_applications(p_job_id, v_user_id) then
    v_is_authorized := true;
  elsif exists (
    select 1 from public.job_applications ja
    where ja.job_id = p_job_id and ja.student_user_id = v_user_id
  ) then
    v_is_authorized := true;
  end if;

  if not v_is_authorized then
    return;
  end if;

  return query
  with job_stats as (
    select
      ja.job_id,
      count(*)::integer as total_apps,
      count(*) filter (where ja.status in ('viewed', 'screened', 'interview_scheduled', 'processing', 'hired', 'joined', 'rejected'))::integer as viewed_apps,
      count(*) filter (where ja.status in ('screened', 'processing'))::integer as shortlisted_apps,
      count(*) filter (where ja.status = 'interview_scheduled')::integer as interview_apps,
      count(*) filter (where ja.status in ('hired', 'joined'))::integer as hired_apps,
      bool_or(ja.status != 'applied') as has_status_action,
      max(ja.updated_at) as latest_update
    from public.job_applications ja
    where ja.job_id = p_job_id
      and ja.status != 'withdrawn'
    group by ja.job_id
  )
  select
    js.job_id,
    (js.total_apps > 50 and coalesce(js.has_status_action, false)) as unlocked,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.total_apps else null end as total_applications,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.viewed_apps else null end as viewed_count,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.shortlisted_apps else null end as shortlisted_count,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.interview_apps else null end as interview_scheduled_count,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.hired_apps else null end as hired_count,
    case
      when not (js.total_apps > 50 and coalesce(js.has_status_action, false)) then null
      when js.hired_apps > 0 then 'hiring_completed'
      when js.interview_apps > 0 then 'interviewing'
      when js.shortlisted_apps > 0 then 'shortlisting'
      when js.viewed_apps > 0 then 'reviewing'
      else 'actively_hiring'
    end as hiring_stage,
    case when (js.total_apps > 50 and coalesce(js.has_status_action, false)) then js.latest_update else null end as last_activity_at
  from job_stats js;
end;
$$;

grant execute on function public.get_job_hiring_progress(uuid) to authenticated;
