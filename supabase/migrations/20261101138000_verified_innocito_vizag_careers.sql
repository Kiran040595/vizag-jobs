BEGIN;

UPDATE public.companies
SET careers_url = 'https://innocito.com/careers'
WHERE lower(btrim(name)) = 'innocito';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE lower(btrim(name)) = 'innocito'
  AND careers_url = 'https://innocito.com/careers';

COMMIT;
