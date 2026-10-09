begin;

-- Internal jobs are link-only. Existing public read policies, listings, sitemaps
-- and notification dispatchers continue to require status = 'published'.
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
 check (status in ('draft','pending','published','archived') or (status='internal' and is_quick_job));

create or replace function public.get_quick_job(p_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',j.id,'slug',j.slug,'title',j.title,'company',j.company,'location',j.location,'salary',j.salary,'description',j.description,
 'status',j.status,'role',j.role,'form_id',f.id,'fields',f.fields,'is_open',f.is_open and (j.expires_at is null or j.expires_at>now()))
 from public.jobs j join lateral(select * from public.quick_job_forms where job_id=j.id order by version desc limit 1) f on true
 where (j.slug=p_slug or j.id::text=p_slug) and j.status in ('published','internal') and j.is_quick_job;
$$;

create or replace function public.save_quick_job(p_job jsonb,p_fields jsonb,p_job_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare jid uuid; owner_id uuid; company_label text; v integer;
begin
 if not public.is_admin(auth.uid()) then raise exception 'Admin access required'; end if;
 if p_job ? 'status' and coalesce(p_job->>'status','') not in ('draft','internal','published') then raise exception 'Invalid quick job visibility'; end if;
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
 update public.jobs set status=coalesce(p_job->>'status','internal') where id=jid;
 return jid;
end $$;

create or replace function public.submit_quick_application(p_job_id uuid,p_form_id uuid,p_answers jsonb,p_token_hash text,p_source text,p_ip_key text,p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.jobs; f public.quick_job_forms; cid uuid; aid uuid; lim integer; k text; linked_uid uuid; phone_value text:=p_answers->>'phone';
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server access required'; end if;
 if length(p_token_hash)<>64 or phone_value !~ '^\+91[6-9][0-9]{9}$' or length(coalesce(p_answers->>'full_name','')) not between 2 and 200 then raise exception 'Invalid submission'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_job_id::text||phone_value,0));
 if exists(select 1 from public.quick_application_receipts r join public.job_applications a on a.id=r.application_id where r.token_hash=p_token_hash and a.job_id=p_job_id) then return jsonb_build_object('accepted',true,'claimable',true); end if;
 if exists(select 1 from public.quick_application_receipts where token_hash=p_token_hash) then raise exception 'Invalid submission receipt'; end if;
 select * into j from public.jobs where id=p_job_id for share;
 select * into f from public.quick_job_forms where id=p_form_id and job_id=p_job_id;
 if j.id is null or j.status not in ('published','internal') or not j.is_quick_job or f.id is null or not f.is_open or (j.expires_at is not null and j.expires_at<=now())
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

commit;
