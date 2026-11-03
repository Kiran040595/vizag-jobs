-- Add last_fetched_at to track 7-day cooldown for automated direct company career fetches
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS last_fetched_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_companies_last_fetched ON public.companies (last_fetched_at);
