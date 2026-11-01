BEGIN;

UPDATE public.companies
SET careers_url = 'https://www.celestinfo.com/careers.html'
WHERE name = 'Celestinfo Software Solutions Pvt. Ltd.';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE name = 'Celestinfo Software Solutions Pvt. Ltd.'
  AND careers_url = 'https://www.celestinfo.com/careers.html';

COMMIT;
