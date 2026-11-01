-- Directory approval certifies the exact careers URL. Historical approval was
-- imported in bulk and is not evidence that a portal lists Vizag vacancies.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS verified_careers_url text;

UPDATE public.companies SET is_directory_approved = false
WHERE is_directory_approved = true AND verified_careers_url IS DISTINCT FROM careers_url;

CREATE OR REPLACE FUNCTION public.guard_company_directory_careers()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.careers_url IS DISTINCT FROM OLD.careers_url THEN
      NEW.is_directory_approved := false;
      NEW.verified_careers_url := NULL;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.is_directory_approved THEN
    IF NEW.careers_url IS NULL OR btrim(NEW.careers_url) !~ '^https?://[^/[:space:]]+' THEN
      RAISE EXCEPTION 'A valid verified careers URL is required for the public directory';
    END IF;
    NEW.verified_careers_url := NEW.careers_url;
  ELSE
    NEW.verified_careers_url := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_company_directory_careers ON public.companies;
CREATE TRIGGER guard_company_directory_careers
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.guard_company_directory_careers();
