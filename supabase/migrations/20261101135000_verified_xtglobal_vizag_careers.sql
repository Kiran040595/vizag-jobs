BEGIN;

UPDATE public.companies
SET careers_url = 'https://xtglobal.zohorecruit.in/jobs/Careers'
WHERE name IN ('XTGlobal', 'XTGLOBAL', 'xtglobal', 'XTGlobal Inc.');

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE name IN ('XTGlobal', 'XTGLOBAL', 'xtglobal', 'XTGlobal Inc.')
  AND careers_url = 'https://xtglobal.zohorecruit.in/jobs/Careers';

COMMIT;
