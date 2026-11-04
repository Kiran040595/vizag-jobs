BEGIN;

UPDATE public.companies
SET website = 'https://www.vareximaging.com',
    careers_url = 'https://vareximaging.wd103.myworkdayjobs.com/External_Career_Site?locations=6dd16ee3ba301001dd775f79921c0000',
    category = 'Healthcare',
    is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = '68c6c6bb-c273-4d44-9de6-bb85fd40eab5'
  AND lower(btrim(name)) = 'varex imaging manufacturing india pvt. ltd.';

COMMIT;
