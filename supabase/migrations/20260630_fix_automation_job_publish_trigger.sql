-- Employer submission rules must not override service-role automation inserts.
-- GitHub Actions / CLI pipelines use the service role (auth.uid() is null) and
-- intentionally insert status = 'published'. The previous trigger fired for any
-- non-admin insert, including service role, and forced status = 'pending'.

drop trigger if exists enforce_job_submission_rules_insert on public.jobs;
create trigger enforce_job_submission_rules_insert
before insert on public.jobs
for each row
when (auth.uid() is not null and not public.is_admin(auth.uid()))
execute function public.enforce_job_submission_rules();

drop trigger if exists enforce_job_submission_rules_update on public.jobs;
create trigger enforce_job_submission_rules_update
before update on public.jobs
for each row
when (auth.uid() is not null and not public.is_admin(auth.uid()))
execute function public.enforce_job_submission_rules();

-- Publish automation jobs that were incorrectly forced to pending.
update public.jobs
set status = 'published'
where status = 'pending'
  and created_by is null
  and coalesce(source_name, '') <> '';
