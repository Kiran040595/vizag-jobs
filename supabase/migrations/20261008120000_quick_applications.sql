begin;
alter table public.jobs add column if not exists is_quick_job boolean not null default false;
create table public.quick_job_forms (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs(id) on delete cascade,
 version integer not null, fields jsonb not null, is_open boolean not null default true,
 created_at timestamptz not null default now(), unique(job_id,version),
 check(jsonb_typeof(fields)='array' and jsonb_array_length(fields) between 2 and 20)
);
create table public.quick_form_templates (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80),
 fields jsonb not null check(jsonb_typeof(fields)='array' and jsonb_array_length(fields) between 2 and 20)
);
create table public.quick_candidates (
 id uuid primary key default gen_random_uuid(), full_name text not null, phone text not null check(phone ~ '^\+91[6-9][0-9]{9}$'),
 user_id uuid references auth.users(id) on delete set null, needs_review boolean not null default false,
 created_at timestamptz not null default now()
);
create index quick_candidates_phone_idx on public.quick_candidates(phone);
create unique index quick_candidates_guest_identity on public.quick_candidates(phone,lower(btrim(full_name))) where user_id is null;
alter table public.job_applications alter column student_user_id drop not null;
alter table public.job_applications
 add column quick_candidate_id uuid references public.quick_candidates(id),
 add column quick_form_id uuid references public.quick_job_forms(id),
 add column form_answers jsonb not null default '{}',
 add column form_snapshot jsonb not null default '[]',
 add column application_source text,
 add column applicant_phone text,
 add column applied_role text,
 add column application_consent_at timestamptz;
create unique index quick_job_phone_once on public.job_applications(job_id,applicant_phone) where quick_form_id is not null;
create index quick_applications_candidate_idx on public.job_applications(quick_candidate_id);
create table public.quick_application_receipts (
 token_hash text primary key, application_id uuid not null references public.job_applications(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.quick_application_limits (
 key text primary key, bucket timestamptz not null, attempts integer not null default 1
);
alter table public.quick_job_forms enable row level security;
alter table public.quick_form_templates enable row level security;
alter table public.quick_candidates enable row level security;
alter table public.quick_application_receipts enable row level security;
alter table public.quick_application_limits enable row level security;
create policy quick_forms_admin on public.quick_job_forms for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
create policy quick_templates_admin on public.quick_form_templates for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
create policy quick_candidates_admin on public.quick_candidates for select to authenticated using(public.is_admin(auth.uid()));
grant select,insert,update,delete on public.quick_form_templates to authenticated;
revoke all on public.quick_application_receipts,public.quick_application_limits from anon,authenticated;
revoke all on public.quick_job_forms,public.quick_candidates from anon,authenticated;
grant select on public.quick_job_forms,public.quick_candidates to authenticated;

create function public.get_quick_job(p_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',j.id,'slug',j.slug,'title',j.title,'company',j.company,'location',j.location,'salary',j.salary,'description',j.description,
 'role',j.role,'form_id',f.id,'fields',f.fields,'is_open',f.is_open and (j.expires_at is null or j.expires_at>now()))
 from public.jobs j join lateral(select * from public.quick_job_forms where job_id=j.id order by version desc limit 1) f on true
 where (j.slug=p_slug or j.id::text=p_slug) and j.status='published' and j.is_quick_job;
$$;
revoke all on function public.get_quick_job(text) from public;
grant execute on function public.get_quick_job(text) to anon,authenticated;

create function public.save_quick_job(p_job jsonb,p_fields jsonb,p_job_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare jid uuid; owner_id uuid; company_label text; v integer;
begin
 if not public.is_admin(auth.uid()) then raise exception 'Admin access required'; end if;
 if jsonb_typeof(p_fields)<>'array' or jsonb_array_length(p_fields) not between 2 and 20 then raise exception 'Invalid form'; end if;
 if length(btrim(coalesce(p_job->>'title',''))) not between 3 and 150 or length(btrim(coalesce(p_job->>'location',''))) not between 2 and 150
 or length(btrim(coalesce(p_job->>'role',''))) not between 2 and 100 or length(btrim(coalesce(p_job->>'description',''))) not between 10 and 10000 then raise exception 'Title, role, location and job details are required'; end if;
 owner_id := nullif(p_job->>'owner_id','')::uuid;
 if owner_id is not null then
  select company_name into company_label from public.employer_profiles where user_id=owner_id and is_active;
  if company_label is null then raise exception 'Choose an active employer'; end if;
 end if;
 company_label:=coalesce(company_label,nullif(btrim(p_job->>'company'),''),'Jobs in Vizag Recruitment');
 if p_job_id is null then
  jid:=gen_random_uuid();
  insert into public.jobs(id,slug,title,company,location,category,role,job_type,salary,description,short_description,apply_mode,is_quick_job,status,created_by)
  values(jid,regexp_replace(lower(btrim(p_job->>'title')),'[^a-z0-9]+','-','g')||'-'||left(jid::text,8),btrim(p_job->>'title'),company_label,btrim(p_job->>'location'),'Other',btrim(p_job->>'role'),'Full Time',left(p_job->>'salary',200),p_job->>'description',left(p_job->>'description',240),'internal',true,'draft',owner_id);
 else
  jid:=p_job_id;
  perform 1 from public.jobs where id=jid and is_quick_job for update;
  if not found then raise exception 'Quick job not found'; end if;
  update public.jobs set title=btrim(p_job->>'title'),company=company_label,location=btrim(p_job->>'location'),role=btrim(p_job->>'role'),salary=left(p_job->>'salary',200),description=p_job->>'description',short_description=left(p_job->>'description',240),created_by=owner_id where id=jid;
 end if;
 select coalesce(max(version),0)+1 into v from public.quick_job_forms where job_id=jid;
 insert into public.quick_job_forms(job_id,version,fields,is_open) values(jid,v,p_fields,coalesce((p_job->>'is_open')::boolean,true));
 update public.jobs set status=case when p_job->>'status'='draft' then 'draft' else 'published' end where id=jid;
 return jid;
end $$;
revoke all on function public.save_quick_job(jsonb,jsonb,uuid) from public;
grant execute on function public.save_quick_job(jsonb,jsonb,uuid) to authenticated;

-- Only the server may submit; it validates answers against the stored form, never client schema.
create function public.submit_quick_application(p_job_id uuid,p_form_id uuid,p_answers jsonb,p_token_hash text,p_source text,p_ip_key text,p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.jobs; f public.quick_job_forms; cid uuid; aid uuid; lim integer; k text; linked_uid uuid; phone_value text:=p_answers->>'phone';
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server access required'; end if;
 if length(p_token_hash)<>64 or phone_value !~ '^\+91[6-9][0-9]{9}$' or length(coalesce(p_answers->>'full_name','')) not between 2 and 200 then raise exception 'Invalid submission'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_job_id::text||phone_value,0));
 if exists(select 1 from public.quick_application_receipts where token_hash=p_token_hash) then return jsonb_build_object('accepted',true,'claimable',true); end if;
 select * into j from public.jobs where id=p_job_id for share;
 select * into f from public.quick_job_forms where id=p_form_id and job_id=p_job_id;
 if j.id is null or j.status<>'published' or not j.is_quick_job or f.id is null or not f.is_open or (j.expires_at is not null and j.expires_at<=now())
 or exists(select 1 from public.quick_job_forms where job_id=j.id and version>f.version) then raise exception 'This application form is closed or has changed. Refresh the page.'; end if;
 foreach k in array array['ip:'||p_ip_key,'phone:'||phone_value] loop
  insert into public.quick_application_limits(key,bucket) values(k,date_trunc('hour',now()))
  on conflict(key) do update set attempts=case when quick_application_limits.bucket=excluded.bucket then quick_application_limits.attempts+1 else 1 end,bucket=excluded.bucket returning attempts into lim;
  if lim>30 then raise exception 'Too many attempts. Please try again later.'; end if;
 end loop;
 if exists(select 1 from public.job_applications where job_id=j.id and applicant_phone=phone_value and quick_form_id is not null) then return jsonb_build_object('accepted',true,'claimable',false); end if;
 if p_user_id is not null and exists(select 1 from public.student_profiles where user_id=p_user_id and is_active) then linked_uid:=p_user_id; end if;
 if linked_uid is not null and exists(select 1 from public.job_applications where job_id=j.id and student_user_id=linked_uid) then return jsonb_build_object('accepted',true,'claimable',false); end if;
 -- Name + phone groups provisional guests only. A typed number never grants account access.
 perform pg_advisory_xact_lock(hashtextextended(phone_value,1));
 if linked_uid is null then select id into cid from public.quick_candidates where phone=phone_value and lower(btrim(full_name))=lower(btrim(p_answers->>'full_name')) and user_id is null; end if;
 if cid is null then
  insert into public.quick_candidates(full_name,phone,user_id,needs_review) values(p_answers->>'full_name',phone_value,linked_uid,exists(select 1 from public.quick_candidates where phone=phone_value)) returning id into cid;
 end if;
 insert into public.job_applications(job_id,student_user_id,status,quick_candidate_id,quick_form_id,form_answers,form_snapshot,application_source,applicant_phone,applied_role,application_consent_at,profile_snapshot,cover_note)
 values(j.id,linked_uid,'applied',cid,f.id,p_answers,f.fields,left(p_source,80),phone_value,j.role,now(),jsonb_build_object('fullName',p_answers->>'full_name','phone',phone_value,'degree',coalesce(p_answers->>'education',''),'currentCity',coalesce(p_answers->>'location',''),'contactEmail',coalesce(p_answers->>'email',''),'quickAnswers',p_answers,'quickFields',f.fields),
 (select string_agg((field->>'label')||': '||coalesce(p_answers->>(field->>'id'),''),E'\n') from jsonb_array_elements(f.fields) field)) returning id into aid;
 insert into public.quick_application_receipts(token_hash,application_id) values(p_token_hash,aid);
 return jsonb_build_object('accepted',true,'claimable',true);
end $$;
revoke all on function public.submit_quick_application(uuid,uuid,jsonb,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_quick_application(uuid,uuid,jsonb,text,text,text,uuid) to service_role;

-- A receipt proves ownership of an individual submission; phone matching alone never links records.
create function public.claim_quick_applications(p_token_hashes text[]) returns integer language plpgsql security definer set search_path=public as $$
declare a record; n integer:=0;
begin
 if auth.uid() is null or not exists(select 1 from public.student_profiles where user_id=auth.uid() and is_active) then raise exception 'Student sign in required'; end if;
 if cardinality(p_token_hashes)>50 then raise exception 'Too many receipts'; end if;
 for a in select ja.* from public.job_applications ja join public.quick_application_receipts r on r.application_id=ja.id
 where r.token_hash=any(p_token_hashes) and r.created_at>now()-interval '30 days' and ja.student_user_id is null for update of ja loop
  if exists(select 1 from public.job_applications where job_id=a.job_id and student_user_id=auth.uid()) then
   update public.quick_candidates set needs_review=true where id=a.quick_candidate_id;
  else
   update public.job_applications set student_user_id=auth.uid() where id=a.id;
   -- Only promote the claimed application. Other applications sharing an unverified phone remain guests.
   insert into public.quick_candidates(full_name,phone,user_id) select full_name,phone,auth.uid() from public.quick_candidates where id=a.quick_candidate_id returning id into a.quick_candidate_id;
   update public.job_applications set quick_candidate_id=a.quick_candidate_id where id=a.id;
   n:=n+1;
  end if;
 end loop;
 return n;
end $$;
revoke all on function public.claim_quick_applications(text[]) from public;
grant execute on function public.claim_quick_applications(text[]) to authenticated;
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
    coalesce(auth.role(), '') = 'service_role'
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
    coalesce(auth.role(), '') = 'service_role'
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
commit;
