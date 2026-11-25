BEGIN;

UPDATE public.companies
SET website = 'https://www.infinite.com',
    careers_url = 'https://sjobs.brassring.com/TGNewUI/Search/Home/Home?partnerid=26656&siteid=5008#keyWord=Visakhapatnam'
WHERE id = 'a5c59cbe-11aa-41d4-a0ca-c2a94326687d'
  AND lower(btrim(name)) = 'infinite computer solutions';

UPDATE public.companies
SET is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = 'a5c59cbe-11aa-41d4-a0ca-c2a94326687d'
  AND lower(btrim(name)) = 'infinite computer solutions'
  AND careers_url = 'https://sjobs.brassring.com/TGNewUI/Search/Home/Home?partnerid=26656&siteid=5008#keyWord=Visakhapatnam';

UPDATE public.companies
SET website = 'https://www.pbltransport.co.in/',
    careers_url = 'https://jobs.pbltransport.co.in/jobs/Careers'
WHERE id = '040c50a3-7411-4c6d-9f58-e5a8e574d52c'
  AND lower(btrim(name)) = 'pbl transport corporation';

UPDATE public.companies
SET is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = '040c50a3-7411-4c6d-9f58-e5a8e574d52c'
  AND lower(btrim(name)) = 'pbl transport corporation'
  AND careers_url = 'https://jobs.pbltransport.co.in/jobs/Careers';

COMMIT;
