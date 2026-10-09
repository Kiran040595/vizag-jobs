begin;
-- Reuse the existing group_link column for all job types.
alter table public.jobs add column if not exists group_link text;

create or replace function public.get_quick_job(p_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',j.id,'slug',j.slug,'title',j.title,'company',j.company,'location',j.location,'salary',j.salary,'description',j.description,
 'group_link',j.group_link,'status',j.status,'role',j.role,'form_id',f.id,'fields',f.fields,'is_open',f.is_open and (j.expires_at is null or j.expires_at>now()))
 from public.jobs j join lateral(select * from public.quick_job_forms where job_id=j.id order by version desc limit 1) f on true
 where (j.slug=p_slug or j.id::text=p_slug) and j.status in ('published','internal') and j.is_quick_job;
$$;

create or replace function public.save_quick_job(p_job jsonb,p_fields jsonb,p_job_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare jid uuid; owner_id uuid; company_label text; v integer; communication_link text;
begin
 if not public.is_admin(auth.uid()) then raise exception 'Admin access required'; end if;
 communication_link := nullif(btrim(p_job->>'group_link'),'');
 if communication_link is not null and (length(communication_link)>2000 or communication_link !~* '^https://[^[:space:]]+$') then raise exception 'Enter a valid HTTPS group or channel link'; end if;
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
 update public.jobs set group_link=case when p_job ? 'group_link' then communication_link else group_link end, status=coalesce(p_job->>'status','internal') where id=jid;
 return jid;
end $$;


commit;
