BEGIN;

UPDATE public.companies
SET website = 'https://www.miraclesoft.com',
    careers_url = 'https://careers.miraclesoft.com/open-positions/',
    verified_careers_url = 'https://careers.miraclesoft.com/open-positions/'
WHERE id = 'fa85ccd8-f0e1-4b61-aba9-3ee90e4b221a'
  AND lower(btrim(name)) = 'miracle software systems';

UPDATE public.companies
SET is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = 'fa85ccd8-f0e1-4b61-aba9-3ee90e4b221a'
  AND lower(btrim(name)) = 'miracle software systems'
  AND careers_url = 'https://careers.miraclesoft.com/open-positions/'
  AND verified_careers_url = 'https://careers.miraclesoft.com/open-positions/';

COMMIT;
