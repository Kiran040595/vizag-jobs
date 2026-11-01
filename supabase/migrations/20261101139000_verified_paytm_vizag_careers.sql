BEGIN;

UPDATE public.companies
SET website = 'https://paytm.com',
    careers_url = 'https://jobs.lever.co/paytm?by=location&location=Vizag%2C+Andhra+Pradesh'
WHERE lower(btrim(name)) = 'paytm';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE lower(btrim(name)) = 'paytm'
  AND careers_url = 'https://jobs.lever.co/paytm?by=location&location=Vizag%2C+Andhra+Pradesh';

COMMIT;
