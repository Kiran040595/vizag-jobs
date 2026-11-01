BEGIN;

UPDATE public.companies
SET careers_url = 'https://careers.miraclesoft.com/open-positions/'
WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) IN (
  'miraclesoftwaresystems',
  'miraclesoftwaresystemsinc',
  'miraclesoft'
);

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE lower(btrim(name)) = 'miracle software systems'
  AND careers_url = 'https://careers.miraclesoft.com/open-positions/';

COMMIT;
