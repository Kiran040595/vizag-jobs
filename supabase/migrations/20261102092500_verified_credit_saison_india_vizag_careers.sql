BEGIN;

UPDATE public.companies
SET website = 'https://creditsaison.in',
    careers_url = 'https://saison.wd102.myworkdayjobs.com/Credit_Saison_India?q=Visakhapatnam'
WHERE lower(btrim(name)) = 'credit saison india';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE lower(btrim(name)) = 'credit saison india'
  AND careers_url = 'https://saison.wd102.myworkdayjobs.com/Credit_Saison_India?q=Visakhapatnam';

COMMIT;
