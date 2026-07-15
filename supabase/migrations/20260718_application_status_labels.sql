-- Rename application statuses to student-friendly values:
-- submitted -> applied, shortlisted -> processing, plus new hired status.

alter table public.job_applications
  drop constraint if exists job_applications_status_check;

update public.job_applications
set status = 'applied'
where status = 'submitted';

update public.job_applications
set status = 'processing'
where status = 'shortlisted';

alter table public.job_applications
  alter column status set default 'applied';

alter table public.job_applications
  add constraint job_applications_status_check
  check (status in ('applied', 'viewed', 'processing', 'hired', 'rejected', 'withdrawn'));

drop policy if exists "Students insert own job applications" on public.job_applications;
create policy "Students insert own job applications"
on public.job_applications
for insert
to authenticated
with check (
  student_user_id = auth.uid()
  and status = 'applied'
  and public.job_accepts_internal_applications(job_id)
  and public.student_can_apply_internally(auth.uid())
);
