BEGIN;

UPDATE public.companies
SET website = 'https://www.rotork.com',
    careers_url = 'https://careers.smartrecruiters.com/Rotork1?search=Visakhapatnam',
    is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = 'f4c1f2b9-8ee6-4619-9cc7-fa7732c2655e'
  AND lower(btrim(name)) = 'rotork';

COMMIT;
