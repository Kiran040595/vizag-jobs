BEGIN;
WITH verified(name, url) AS (VALUES
  ('amazon', 'https://www.amazon.jobs/en/search?city=Visakhapatnam&country=IND&county=Visakhapatnam&latitude=17.7199&loc_query=Visakhapatnam%2C+Andhra+Pradesh%2C+India&longitude=83.26281&radius=24km&region=Andhra+Pradesh')
)
UPDATE public.companies c SET careers_url = v.url
FROM verified v WHERE lower(btrim(c.name)) = v.name;
WITH verified(name, url) AS (VALUES
  ('amazon', 'https://www.amazon.jobs/en/search?city=Visakhapatnam&country=IND&county=Visakhapatnam&latitude=17.7199&loc_query=Visakhapatnam%2C+Andhra+Pradesh%2C+India&longitude=83.26281&radius=24km&region=Andhra+Pradesh')
)
UPDATE public.companies c SET is_directory_approved = true, is_active_for_scrape = true
FROM verified v WHERE lower(btrim(c.name)) = v.name AND c.careers_url = v.url;
COMMIT;
