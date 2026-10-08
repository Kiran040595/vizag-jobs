begin;
-- Registration on a different device cannot prove ownership of earlier submissions.
-- Flag matching provisional records for admin review instead of silently merging them.
create function public.mark_quick_candidate_registration_review() returns trigger language plpgsql security definer set search_path=public as $$
declare digits text:=regexp_replace(coalesce(new.phone,''),'[^0-9]','','g');
begin
 if digits ~ '^(91)?[6-9][0-9]{9}$' then
  update public.quick_candidates c set needs_review=true where c.user_id is null and c.phone='+91'||right(digits,10)
  and exists(select 1 from public.job_applications a where a.quick_candidate_id=c.id and a.student_user_id is null);
 end if;
 return new;
end $$;
create trigger quick_candidate_registration_review after insert or update of phone on public.student_profiles for each row execute function public.mark_quick_candidate_registration_review();
create function public.admin_link_quick_application(p_application_id uuid,p_student_user_id uuid,p_identity_confirmed boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare a public.job_applications; c public.quick_candidates; cid uuid;
begin
 if not public.is_admin(auth.uid()) then raise exception 'Admin access required'; end if;
 if p_identity_confirmed is distinct from true then raise exception 'Confirm account ownership first'; end if;
 if not exists(select 1 from public.student_profiles where user_id=p_student_user_id and is_active) then raise exception 'Active student account required'; end if;
 select * into a from public.job_applications where id=p_application_id for update;
 if a.id is null or a.quick_candidate_id is null or a.student_user_id is not null then raise exception 'Guest application not found'; end if;
 if exists(select 1 from public.job_applications where job_id=a.job_id and student_user_id=p_student_user_id) then raise exception 'This account already applied for the job. Keep both records for review; no history was overwritten.'; end if;
 select * into c from public.quick_candidates where id=a.quick_candidate_id;
 insert into public.quick_candidates(full_name,phone,user_id) values(c.full_name,c.phone,p_student_user_id) returning id into cid;
 update public.job_applications set student_user_id=p_student_user_id,quick_candidate_id=cid where id=a.id;
 return cid;
end $$;
revoke all on function public.admin_link_quick_application(uuid,uuid,boolean) from public;
grant execute on function public.admin_link_quick_application(uuid,uuid,boolean) to authenticated;
commit;
