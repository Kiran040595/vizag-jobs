-- Allow employers and job moderators to view apply clicks and student candidate records for their jobs

-- 1. Update RLS policy on public.job_apply_clicks
alter table public.job_apply_clicks enable row level security;

drop policy if exists "Admins read apply clicks" on public.job_apply_clicks;
drop policy if exists "Admins and job moderators read apply clicks" on public.job_apply_clicks;

create policy "Admins and job moderators read apply clicks"
on public.job_apply_clicks
for select
to authenticated
using (
  public.is_admin(auth.uid())
  or public.can_view_job_applications(job_id, auth.uid())
);

-- 2. Update storage policy to allow employers to read resumes of students who applied/clicked
drop policy if exists "Moderators read application resumes" on storage.objects;

create policy "Moderators read application resumes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-resumes'
  and (
    exists (
      select 1
      from public.job_applications ja
      where ja.resume_path = storage.objects.name
        and public.can_view_job_applications(ja.job_id, auth.uid())
    )
    or exists (
      select 1
      from public.job_apply_clicks jac
      join public.student_profiles sp on sp.user_id = jac.user_id
      where sp.resume_path = storage.objects.name
        and public.can_view_job_applications(jac.job_id, auth.uid())
    )
  )
);

-- 3. Unified RPC function to fetch all candidates (on-platform + apply clicks) for a job
create or replace function public.get_job_applicant_records(p_job_id uuid)
returns table (
  id text,
  source text,
  job_id uuid,
  user_id uuid,
  status text,
  full_name text,
  phone text,
  email text,
  college text,
  degree text,
  branch text,
  graduation_year integer,
  skills text[],
  is_fresher boolean,
  cover_note text,
  resume_path text,
  resume_share_token text,
  recruiter_notes text,
  interview_scheduled_at timestamptz,
  interview_mode text,
  interview_location text,
  interview_instructions text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    current_user in ('postgres', 'service_role', 'supabase_admin')
    or public.is_admin(auth.uid())
    or public.can_view_job_applications(p_job_id, auth.uid())
  ) then
    raise exception 'Not authorized to view applicants for this job';
  end if;

  return query
  with internal_apps as (
    select
      ja.id::text as app_id,
      'internal'::text as app_source,
      ja.job_id as app_job_id,
      ja.student_user_id as app_user_id,
      ja.status as app_status,
      coalesce(nullif(trim(ja.profile_snapshot->>'fullName'), ''), sp.full_name, 'Student Applicant') as app_full_name,
      coalesce(nullif(trim(ja.profile_snapshot->>'phone'), ''), sp.phone, '') as app_phone,
      coalesce(nullif(trim(ja.profile_snapshot->>'contactEmail'), ''), sp.contact_email, '') as app_email,
      coalesce(nullif(trim(ja.profile_snapshot->>'college'), ''), sp.college, '') as app_college,
      coalesce(nullif(trim(ja.profile_snapshot->>'degree'), ''), sp.degree, '') as app_degree,
      coalesce(nullif(trim(ja.profile_snapshot->>'branch'), ''), sp.branch, '') as app_branch,
      nullif(ja.profile_snapshot->>'graduationYear', '')::integer as app_grad_year,
      sp.skills as app_skills,
      coalesce((ja.profile_snapshot->>'isFresher')::boolean, sp.is_fresher, true) as app_is_fresher,
      ja.cover_note as app_cover_note,
      coalesce(ja.resume_path, sp.resume_path) as app_resume_path,
      ja.resume_share_token::text as app_resume_share_token,
      ja.recruiter_notes as app_recruiter_notes,
      ja.interview_scheduled_at as app_interview_scheduled_at,
      ja.interview_mode as app_interview_mode,
      ja.interview_location as app_interview_location,
      ja.interview_instructions as app_interview_instructions,
      ja.submitted_at as app_created_at
    from public.job_applications ja
    left join public.student_profiles sp on sp.user_id = ja.student_user_id
    where ja.job_id = p_job_id
  ),
  applied_uids as (
    select ia.app_user_id from internal_apps ia where ia.app_user_id is not null
  ),
  external_clicks as (
    select
      jac.id::text as app_id,
      'external_click'::text as app_source,
      jac.job_id as app_job_id,
      jac.user_id as app_user_id,
      'external_click'::text as app_status,
      coalesce(nullif(trim(sp.full_name), ''), case when jac.user_id is not null then 'Registered Student' else 'External Visitor' end) as app_full_name,
      coalesce(sp.phone, '') as app_phone,
      coalesce(sp.contact_email, '') as app_email,
      coalesce(sp.college, '') as app_college,
      coalesce(sp.degree, '') as app_degree,
      coalesce(sp.branch, '') as app_branch,
      sp.graduation_year as app_grad_year,
      sp.skills as app_skills,
      coalesce(sp.is_fresher, true) as app_is_fresher,
      case
        when jac.user_id is not null then 'Clicked Apply (Redirected to official/company application link)'
        else 'Anonymous visitor clicked Apply (Redirected to official application link)'
      end as app_cover_note,
      sp.resume_path as app_resume_path,
      null::text as app_resume_share_token,
      null::text as app_recruiter_notes,
      null::timestamptz as app_interview_scheduled_at,
      'in-person'::text as app_interview_mode,
      null::text as app_interview_location,
      null::text as app_interview_instructions,
      jac.created_at as app_created_at
    from public.job_apply_clicks jac
    left join public.student_profiles sp on sp.user_id = jac.user_id
    where jac.job_id = p_job_id
      and (jac.user_id is null or jac.user_id not in (select au.app_user_id from applied_uids au))
  )
  select
    combined.app_id,
    combined.app_source,
    combined.app_job_id,
    combined.app_user_id,
    combined.app_status,
    combined.app_full_name,
    combined.app_phone,
    combined.app_email,
    combined.app_college,
    combined.app_degree,
    combined.app_branch,
    combined.app_grad_year,
    combined.app_skills,
    combined.app_is_fresher,
    combined.app_cover_note,
    combined.app_resume_path,
    combined.app_resume_share_token,
    combined.app_recruiter_notes,
    combined.app_interview_scheduled_at,
    combined.app_interview_mode,
    combined.app_interview_location,
    combined.app_interview_instructions,
    combined.app_created_at
  from (
    select * from internal_apps
    union all
    select * from external_clicks
  ) combined
  order by combined.app_created_at desc;
end;
$$;

grant execute on function public.get_job_applicant_records(uuid) to authenticated;
