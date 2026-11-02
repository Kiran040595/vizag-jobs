BEGIN;

UPDATE public.companies
SET website = 'https://www.wipro.com',
    careers_url = 'https://careers.wipro.com/search/?q=&locationsearch=Visakhapatnam'
WHERE lower(btrim(name)) = 'wipro';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE lower(btrim(name)) = 'wipro'
  AND careers_url = 'https://careers.wipro.com/search/?q=&locationsearch=Visakhapatnam';

COMMIT;
