BEGIN;

UPDATE public.companies
SET website = 'https://www.inventrax.com',
    careers_url = 'https://pms.inventrax.com/hiring?q=Vishakapatnam',
    is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = 'dc670743-b46e-4718-ade8-05a6833be0c9'
  AND lower(btrim(name)) = 'inventrax';

COMMIT;
