-- Function to update candidate pipeline stage, recruiter notes, and interview details
-- Supports both direct applicants (job_applications) and apply-click student candidates (job_apply_clicks)

create or replace function public.update_job_applicant_stage(
  p_job_id uuid,
  p_candidate_id text default null,
  p_student_user_id uuid default null,
  p_status text default null,
  p_recruiter_notes text default null,
  p_interview_scheduled_at timestamptz default null,
  p_interview_mode text default null,
  p_interview_location text default null,
  p_interview_instructions text default null,
  p_clear_interview boolean default false
)
returns table (
  id text,
  job_id uuid,
  student_user_id uuid,
  status text,
  cover_note text,
  resume_path text,
  resume_share_token text,
  profile_snapshot jsonb,
  recruiter_notes text,
  interview_scheduled_at timestamptz,
  interview_mode text,
  interview_location text,
  interview_instructions text,
  submitted_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_id uuid;
  v_uid uuid := p_student_user_id;
  v_target_status text;
  v_prof record;
  v_snapshot jsonb;
  v_resume_path text;
begin
  -- 1. Authorization check: must be admin or allowed to view/edit this job
  if not (
    current_user in ('postgres', 'service_role', 'supabase_admin')
    or public.is_admin(auth.uid())
    or public.can_view_job_applications(p_job_id, auth.uid())
  ) then
    raise exception 'Not authorized to manage candidates for this job';
  end if;

  -- 2. Normalize status if passed
  if p_status is not null and p_status != '' then
    v_target_status := lower(trim(p_status));
    if v_target_status = 'submitted' then
      v_target_status := 'applied';
    elsif v_target_status = 'shortlisted' then
      v_target_status := 'screened';
    elsif v_target_status = 'external_click' then
      v_target_status := 'applied';
    end if;

    if v_target_status not in ('applied', 'viewed', 'screened', 'interview_scheduled', 'processing', 'hired', 'joined', 'rejected', 'withdrawn') then
      raise exception 'Invalid application status: %', p_status;
    end if;
  end if;

  -- 3. Determine if candidate is already in job_applications
  -- Try finding by candidate_id if it's a valid uuid in job_applications
  if p_candidate_id is not null and p_candidate_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select ja.id, ja.student_user_id into v_app_id, v_uid
    from public.job_applications ja
    where ja.id = p_candidate_id::uuid and ja.job_id = p_job_id;
  end if;

  -- If not found by candidate_id, try by (job_id, student_user_id)
  if v_app_id is null and v_uid is not null then
    select ja.id into v_app_id
    from public.job_applications ja
    where ja.job_id = p_job_id and ja.student_user_id = v_uid;
  end if;

  -- 4. If application already exists, update it
  if v_app_id is not null then
    return query
    update public.job_applications ja
    set
      status = coalesce(v_target_status, ja.status),
      recruiter_notes = case when p_recruiter_notes is not null then p_recruiter_notes else ja.recruiter_notes end,
      interview_scheduled_at = case
        when p_clear_interview then null
        when p_interview_scheduled_at is not null then p_interview_scheduled_at
        else ja.interview_scheduled_at
      end,
      interview_mode = case
        when p_clear_interview then 'in_person'
        when p_interview_mode is not null then p_interview_mode
        else ja.interview_mode
      end,
      interview_location = case
        when p_clear_interview then null
        when p_interview_location is not null then p_interview_location
        else ja.interview_location
      end,
      interview_instructions = case
        when p_clear_interview then null
        when p_interview_instructions is not null then p_interview_instructions
        else ja.interview_instructions
      end,
      updated_at = timezone('utc', now())
    where ja.id = v_app_id
    returning
      ja.id::text,
      ja.job_id,
      ja.student_user_id,
      ja.status,
      ja.cover_note,
      ja.resume_path,
      ja.resume_share_token::text,
      ja.profile_snapshot,
      ja.recruiter_notes,
      ja.interview_scheduled_at,
      ja.interview_mode,
      ja.interview_location,
      ja.interview_instructions,
      ja.submitted_at,
      ja.updated_at;
    return;
  end if;

  -- 5. If application does NOT exist yet, but we have student_user_id, insert it into job_applications
  if v_uid is not null then
    select * into v_prof
    from public.student_profiles sp
    where sp.user_id = v_uid;

    v_snapshot := jsonb_build_object(
      'fullName', coalesce(v_prof.full_name, ''),
      'phone', coalesce(v_prof.phone, ''),
      'contactEmail', coalesce(v_prof.contact_email, ''),
      'college', coalesce(v_prof.college, ''),
      'degree', coalesce(v_prof.degree, ''),
      'branch', coalesce(v_prof.branch, ''),
      'graduationYear', v_prof.graduation_year,
      'skills', coalesce(to_jsonb(v_prof.skills), '[]'::jsonb),
      'isFresher', coalesce(v_prof.is_fresher, true)
    );
    v_resume_path := v_prof.resume_path;

    return query
    insert into public.job_applications (
      job_id,
      student_user_id,
      status,
      cover_note,
      resume_path,
      profile_snapshot,
      recruiter_notes,
      interview_scheduled_at,
      interview_mode,
      interview_location,
      interview_instructions,
      submitted_at,
      updated_at
    )
    values (
      p_job_id,
      v_uid,
      coalesce(v_target_status, 'applied'),
      'Applied via official link / external click',
      v_resume_path,
      v_snapshot,
      p_recruiter_notes,
      case when p_clear_interview then null else p_interview_scheduled_at end,
      coalesce(nullif(p_interview_mode, ''), 'in_person'),
      case when p_clear_interview then null else p_interview_location end,
      case when p_clear_interview then null else p_interview_instructions end,
      timezone('utc', now()),
      timezone('utc', now())
    )
    on conflict (job_id, student_user_id) do update set
      status = coalesce(v_target_status, job_applications.status),
      recruiter_notes = case when p_recruiter_notes is not null then p_recruiter_notes else job_applications.recruiter_notes end,
      interview_scheduled_at = case
        when p_clear_interview then null
        when p_interview_scheduled_at is not null then p_interview_scheduled_at
        else job_applications.interview_scheduled_at
      end,
      interview_mode = case
        when p_clear_interview then 'in_person'
        when p_interview_mode is not null then p_interview_mode
        else job_applications.interview_mode
      end,
      interview_location = case
        when p_clear_interview then null
        when p_interview_location is not null then p_interview_location
        else job_applications.interview_location
      end,
      interview_instructions = case
        when p_clear_interview then null
        when p_interview_instructions is not null then p_interview_instructions
        else job_applications.interview_instructions
      end,
      updated_at = timezone('utc', now())
    returning
      job_applications.id::text,
      job_applications.job_id,
      job_applications.student_user_id,
      job_applications.status,
      job_applications.cover_note,
      job_applications.resume_path,
      job_applications.resume_share_token::text,
      job_applications.profile_snapshot,
      job_applications.recruiter_notes,
      job_applications.interview_scheduled_at,
      job_applications.interview_mode,
      job_applications.interview_location,
      job_applications.interview_instructions,
      job_applications.submitted_at,
      job_applications.updated_at;
    return;
  end if;

  raise exception 'Candidate record not found and no student_user_id provided';
end;
$$;

grant execute on function public.update_job_applicant_stage to authenticated;
