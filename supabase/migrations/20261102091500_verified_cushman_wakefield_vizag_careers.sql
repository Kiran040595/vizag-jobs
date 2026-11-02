BEGIN;

UPDATE public.companies
SET website = 'https://www.cushmanwakefield.com',
    careers_url = 'https://cw.wd1.myworkdayjobs.com/External?q=Vizag'
WHERE lower(btrim(name)) = 'cushman & wakefield';

UPDATE public.companies
SET is_directory_approved = true, is_active_for_scrape = true
WHERE lower(btrim(name)) = 'cushman & wakefield'
  AND careers_url = 'https://cw.wd1.myworkdayjobs.com/External?q=Vizag';

COMMIT;
