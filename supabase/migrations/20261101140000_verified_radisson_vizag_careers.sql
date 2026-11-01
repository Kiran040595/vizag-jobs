BEGIN;

UPDATE public.companies
SET website = 'https://www.radissonhotels.com',
    careers_url = 'https://careers.smartrecruiters.com/RHG?search=Visakhapatnam'
WHERE lower(btrim(name)) = 'radisson hotel group';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE lower(btrim(name)) = 'radisson hotel group'
  AND careers_url = 'https://careers.smartrecruiters.com/RHG?search=Visakhapatnam';

COMMIT;
