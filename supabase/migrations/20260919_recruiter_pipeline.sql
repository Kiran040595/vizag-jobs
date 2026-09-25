-- Phase 1: Recruiter Pipeline & Interview Scheduler for Consultancy Operations
-- 1. Expand application status check constraint
-- 2. Add recruiter_notes, interview_scheduled_at, interview_mode, interview_location, interview_instructions

alter table public.job_applications
  drop constraint if exists job_applications_status_check;

alter table public.job_applications
  add constraint job_applications_status_check
  check (status in (
    'applied',
    'viewed',
    'screened',
    'interview_scheduled',
    'processing',
    'hired',
    'joined',
    'rejected',
    'withdrawn'
  ));

-- Add columns for recruiter pipeline and interview scheduling
alter table public.job_applications
  add column if not exists recruiter_notes text,
  add column if not exists interview_scheduled_at timestamptz,
  add column if not exists interview_mode text default 'in_person'
    check (interview_mode in ('in_person', 'virtual', 'telephonic')),
  add column if not exists interview_location text,
  add column if not exists interview_instructions text;

comment on column public.job_applications.recruiter_notes is
  'Private internal notes written by consultancy staff/recruiters. Hidden from candidate.';

comment on column public.job_applications.interview_scheduled_at is
  'Confirmed interview date and time for client interview round.';

comment on column public.job_applications.interview_mode is
  'in_person (walk-in/venue), virtual (Google Meet/Zoom), or telephonic.';

comment on column public.job_applications.interview_location is
  'Interview venue address, Google Maps link, or virtual meeting URL.';

comment on column public.job_applications.interview_instructions is
  'Special instructions for the candidate (e.g. documents to carry, contact person).';
