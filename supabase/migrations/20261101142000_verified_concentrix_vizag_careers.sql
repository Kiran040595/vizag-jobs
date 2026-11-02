BEGIN;

UPDATE public.companies
SET website = 'https://www.concentrix.com',
    careers_url = 'https://jobs.concentrix.com/job-search/?country=India&city=Visakhapatnam'
WHERE lower(btrim(name)) = 'concentrix';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE lower(btrim(name)) = 'concentrix'
  AND careers_url = 'https://jobs.concentrix.com/job-search/?country=India&city=Visakhapatnam';

COMMIT;
