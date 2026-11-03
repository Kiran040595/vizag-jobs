BEGIN;

UPDATE public.companies
SET website = 'https://www.drreddys.com',
    careers_url = 'https://careers.smartrecruiters.com/DrReddysLaboratoriesLimited?search=Visakhapatnam',
    is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = 'b2f3650a-4a79-4b81-bdf2-0bf727ccab63'
  AND lower(btrim(name)) = 'dr. reddy''s laboratories';

COMMIT;
