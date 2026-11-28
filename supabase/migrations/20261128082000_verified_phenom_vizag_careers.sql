BEGIN;

UPDATE public.companies
SET website = 'https://www.phenom.com',
    careers_url = 'https://careers.phenom.com/global/en/search-results?keywords=Visakhapatnam'
WHERE id = '4c6e8508-b20a-40da-bf67-96e4841fda20'
  AND lower(btrim(name)) = 'phenom';

UPDATE public.companies
SET is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = '4c6e8508-b20a-40da-bf67-96e4841fda20'
  AND lower(btrim(name)) = 'phenom'
  AND careers_url = 'https://careers.phenom.com/global/en/search-results?keywords=Visakhapatnam';

COMMIT;
