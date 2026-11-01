-- Verified official search data: eight results, each in Visakhapatnam.
BEGIN;
UPDATE public.companies
SET careers_url = 'https://careers.conduent.com/us/en/search-results?keywords=Visakhapatnam'
WHERE lower(btrim(name)) = 'conduent';
-- Separate approval statement: changing a URL first revokes its old approval.
UPDATE public.companies SET is_directory_approved = true
WHERE lower(btrim(name)) = 'conduent'
AND careers_url = 'https://careers.conduent.com/us/en/search-results?keywords=Visakhapatnam';
COMMIT;
