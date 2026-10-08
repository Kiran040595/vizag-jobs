begin;
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
commit;
