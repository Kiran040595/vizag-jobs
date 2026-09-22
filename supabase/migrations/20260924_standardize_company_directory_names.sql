-- Migration: Standardize canonical company names across jobs and remove duplicate directory approvals
-- Ensures exact matching between public.companies and public.jobs

-- 1. Standardize company names in public.jobs
UPDATE public.jobs
SET company = 'Tata Consultancy Services'
WHERE company IN ('TCS', 'TCS Visakhapatnam');

UPDATE public.jobs
SET company = 'Miracle Software Systems'
WHERE company IN ('Miracle Software Systems Inc.', 'Miracle Software Systems Inc', 'Miraclesoft');

UPDATE public.jobs
SET company = 'Dr. Reddy''s Laboratories'
WHERE company IN ('Dr Reddys', 'Dr. Reddys');

UPDATE public.jobs
SET company = 'Benovymed Healthcare'
WHERE company IN ('Benovymed Healthcare Private Ltd');

UPDATE public.jobs
SET company = 'Policybazaar'
WHERE company IN ('Policybazaar.com');

UPDATE public.jobs
SET company = 'XTGlobal'
WHERE company IN ('XTGLOBAL');

UPDATE public.jobs
SET company = 'JSE Engineering'
WHERE company IN ('JSE Engineering Pvt. Ltd.');

UPDATE public.jobs
SET company = 'PBL Transport Corporation'
WHERE company IN ('PBL Transport Corporation Private Limited');

-- 2. De-duplicate company directory approvals in public.companies
UPDATE public.companies
SET is_directory_approved = false
WHERE name IN (
  'TCS',
  'TCS Visakhapatnam',
  'Miracle Software Systems Inc.',
  'Miracle Software Systems Inc',
  'Miraclesoft',
  'Dr Reddys',
  'Benovymed Healthcare Private Ltd',
  'Policybazaar.com',
  'XTGLOBAL',
  'Fluentgrid',
  'JSE Engineering Pvt. Ltd.',
  'PBL Transport Corporation Private Limited',
  'Pulsus Group'
);

-- Ensure primary canonical records are approved
UPDATE public.companies
SET is_directory_approved = true
WHERE name IN (
  'Tata Consultancy Services',
  'Miracle Software Systems',
  'Dr. Reddy''s Laboratories',
  'Benovymed Healthcare',
  'Policybazaar',
  'XTGlobal',
  'Fluentgrid Limited',
  'JSE Engineering',
  'PBL Transport Corporation',
  'Pulsus Healthtech'
);
