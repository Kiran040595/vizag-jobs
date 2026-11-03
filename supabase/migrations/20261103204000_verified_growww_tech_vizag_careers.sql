BEGIN;

UPDATE public.companies
SET website = 'https://growwwtech.com',
    careers_url = 'https://growwwtech.com/careers',
    is_directory_approved = true,
    is_active_for_scrape = true
WHERE id = '6bf6742a-7b29-475f-9732-39b80e0e2f7f'
  AND lower(btrim(name)) = 'growww tech';

COMMIT;
