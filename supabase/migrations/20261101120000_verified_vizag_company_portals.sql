-- Evidence recorded in docs/qa/2026-11-01/company-career-verification.md.
BEGIN;
WITH verified(name, url) AS (VALUES
  ('brandix', 'https://careers.brandix.com/search/?q=&locationsearch=Visakhapatnam'),
  ('gmr group', 'https://careers.gmrgroup.in/search/?q=&locationsearch=Visakhapatnam'),
  ('wns', 'https://careers.smartrecruiters.com/WNSGlobalServices144?search=Visakhapatnam'),
  ('fluentgrid', 'https://fluentgrid.com/careers/?job__location_spec=visakhapatnam'),
  ('fluentgrid limited', 'https://fluentgrid.com/careers/?job__location_spec=visakhapatnam')
)
UPDATE public.companies c SET careers_url = v.url
FROM verified v WHERE lower(btrim(c.name)) = v.name;

-- Changing a URL revokes approval in the trigger; reapprove only that exact URL.
WITH verified(name, url) AS (VALUES
  ('brandix', 'https://careers.brandix.com/search/?q=&locationsearch=Visakhapatnam'),
  ('gmr group', 'https://careers.gmrgroup.in/search/?q=&locationsearch=Visakhapatnam'),
  ('wns', 'https://careers.smartrecruiters.com/WNSGlobalServices144?search=Visakhapatnam'),
  ('fluentgrid', 'https://fluentgrid.com/careers/?job__location_spec=visakhapatnam'),
  ('fluentgrid limited', 'https://fluentgrid.com/careers/?job__location_spec=visakhapatnam')
)
UPDATE public.companies c SET is_directory_approved = true, is_active_for_scrape = true
FROM verified v WHERE lower(btrim(c.name)) = v.name AND c.careers_url = v.url;
COMMIT;
