-- Migration: 20261026_application_status_contacted.sql
-- Expands job_applications status check constraint to support 'contacted'
-- Updates update_job_applicant_stage RPC to accept 'contacted'

alter table public.job_applications
  drop constraint if exists job_applications_status_check;

alter table public.job_applications
  add constraint job_applications_status_check
  check (status in (
    'applied',
    'viewed',
    'contacted',
    'screened',
    'interview_scheduled',
    'processing',
    'hired',
    'joined',
    'rejected',
    'withdrawn'
  ));
