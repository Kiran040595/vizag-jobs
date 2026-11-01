BEGIN;

UPDATE public.companies
SET careers_url = 'https://careers.sailssoftware.com/sailssoftware/'
WHERE name = 'Sails Software';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE name = 'Sails Software'
  AND careers_url = 'https://careers.sailssoftware.com/sailssoftware/';

COMMIT;
