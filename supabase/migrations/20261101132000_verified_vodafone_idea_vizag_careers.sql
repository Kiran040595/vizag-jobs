BEGIN;

UPDATE public.companies
SET careers_url = 'https://careers.vodafoneidea.com/search/?q=&locationsearch=Visakhapatnam'
WHERE name = 'Vodafone Idea Limited';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE name = 'Vodafone Idea Limited'
  AND careers_url = 'https://careers.vodafoneidea.com/search/?q=&locationsearch=Visakhapatnam';

COMMIT;
