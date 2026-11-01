BEGIN;
WITH verified(name, url) AS (VALUES
  ('jll', 'https://jll.wd1.myworkdayjobs.com/JLLCareers?locations=38ccc50fa540014356996861e2cc9f0e'),
  ('marriott', 'https://careers.marriott.com/jobs?filter%5Bcity%5D%5B0%5D=Visakhapatnam'),
  ('accor', 'https://careers.accor.com/global/en/jobs?options=992&page=1')
)
UPDATE public.companies c SET careers_url = v.url
FROM verified v WHERE lower(btrim(c.name)) = v.name;
WITH verified(name, url) AS (VALUES
  ('jll', 'https://jll.wd1.myworkdayjobs.com/JLLCareers?locations=38ccc50fa540014356996861e2cc9f0e'),
  ('marriott', 'https://careers.marriott.com/jobs?filter%5Bcity%5D%5B0%5D=Visakhapatnam'),
  ('accor', 'https://careers.accor.com/global/en/jobs?options=992&page=1')
)
UPDATE public.companies c SET is_directory_approved = true, is_active_for_scrape = true
FROM verified v WHERE lower(btrim(c.name)) = v.name AND c.careers_url = v.url;
COMMIT;
