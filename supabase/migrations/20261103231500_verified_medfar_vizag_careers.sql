BEGIN;

UPDATE public.companies
SET website = 'https://www.medfarsolutions.com',
    careers_url = 'https://careers.smartrecruiters.com/Medfar?search=Visakhapatnam',
    is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = '72b6d403-7f64-4298-9557-9f11b53209f6'
  AND lower(btrim(name)) = 'medfar';

COMMIT;
