BEGIN;

UPDATE public.companies
SET website = 'https://www.dmartindia.com',
    careers_url = 'https://careers.dmartindia.com/ASL/search/?q=&locationsearch=Visakhapatnam',
    is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = 'a88226f0-bbd7-4409-98b1-f0b97d80ebd6'
  AND lower(btrim(name)) = 'dmart - avenue supermarts ltd';

COMMIT;
