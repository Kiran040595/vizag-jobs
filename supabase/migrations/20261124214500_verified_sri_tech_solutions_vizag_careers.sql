BEGIN;

UPDATE public.companies
SET website = 'https://sritechsolutions.com',
    careers_url = 'https://sritechsolutions.com/job-openings/?job__location_spec=visakhapatnam'
WHERE id = 'adcf26a3-d7f7-4677-91e9-b3f23f8e6427'
  AND lower(btrim(name)) = 'sri tech solutions inc.';

UPDATE public.companies
SET is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = 'adcf26a3-d7f7-4677-91e9-b3f23f8e6427'
  AND lower(btrim(name)) = 'sri tech solutions inc.'
  AND careers_url = 'https://sritechsolutions.com/job-openings/?job__location_spec=visakhapatnam';

COMMIT;
