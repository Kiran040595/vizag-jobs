BEGIN;

UPDATE public.companies
SET careers_url = 'https://careers.smartrecruiters.com/HMGroup?search=Vishakhapatnam'
WHERE name = 'H&M';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE name = 'H&M'
  AND careers_url = 'https://careers.smartrecruiters.com/HMGroup?search=Vishakhapatnam';

COMMIT;
