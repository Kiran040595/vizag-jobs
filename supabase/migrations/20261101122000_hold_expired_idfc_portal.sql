-- The city-filtered search works, but both detail records are expired.
-- Preserve the corrected URL privately until a current opening is verified.
UPDATE public.companies SET is_directory_approved = false
WHERE lower(btrim(name)) = 'idfc first bank';
