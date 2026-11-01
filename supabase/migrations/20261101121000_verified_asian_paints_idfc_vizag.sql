BEGIN;
WITH verified(name, url) AS (VALUES
  ('asian paints', 'https://careers.asianpaints.com/search/?q=&locationsearch=Visakhapatnam'),
  ('idfc first bank', 'https://careers.idfcfirst.bank.in/in/en/search-results?keywords=Visakhapatnam')
)
UPDATE public.companies c SET careers_url = v.url
FROM verified v WHERE lower(btrim(c.name)) = v.name;
WITH verified(name, url) AS (VALUES
  ('asian paints', 'https://careers.asianpaints.com/search/?q=&locationsearch=Visakhapatnam'),
  ('idfc first bank', 'https://careers.idfcfirst.bank.in/in/en/search-results?keywords=Visakhapatnam')
)
UPDATE public.companies c SET is_directory_approved = true, is_active_for_scrape = true
FROM verified v WHERE lower(btrim(c.name)) = v.name AND c.careers_url = v.url;
COMMIT;
