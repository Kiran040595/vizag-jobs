begin;
grant execute on function public.get_quick_job(text) to service_role;
-- Submission grouping is serialized by the phone advisory lock. Keep the lookup
-- index non-unique so deleting an auth account can safely clear candidate links.
drop index public.quick_candidates_guest_identity;
create index quick_candidates_guest_identity on public.quick_candidates(phone,lower(btrim(full_name))) where user_id is null;
alter table public.job_applications add constraint job_applications_guest_requires_form
 check(student_user_id is not null or (quick_form_id is not null and quick_candidate_id is not null));
commit;
