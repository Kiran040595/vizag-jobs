-- Migration: Add directory approval workflow and pre-approve top 10-20 employers per sector

-- 1. Add is_directory_approved column if not exists
alter table public.companies
add column if not exists is_directory_approved boolean not null default false;

-- 2. Add index for fast querying by directory approval status and category
create index if not exists idx_companies_directory_approved
on public.companies (is_directory_approved, category);

-- 3. Pre-approve top premier companies for each prominent sector in Visakhapatnam

-- IT & Software
update public.companies
set is_directory_approved = true, category = 'IT & Software'
where name in (
  'Tata Consultancy Services',
  'TCS',
  'TCS Visakhapatnam',
  'Infosys',
  'Tech Mahindra',
  'Conduent',
  'WNS',
  'Miracle Software Systems',
  'Miracle Software Systems Inc.',
  'Miracle Software Systems Inc',
  'Miraclesoft',
  'Fluentgrid Limited',
  'Fluentgrid',
  'Symbiosis Technologies',
  'Patra India',
  'Patra Corporation',
  'XTGlobal',
  'XTGLOBAL',
  'Innocito',
  'Sails Software',
  'Cognizant',
  'Amazon',
  'Google',
  'Uber',
  'Turing',
  'BairesDev',
  'iMerit',
  'Mouri Tech'
);

-- Pharma & Healthcare / Hospitals
update public.companies
set is_directory_approved = true, category = 'Healthcare'
where name in (
  'Pfizer',
  'Dr. Reddy''s Laboratories',
  'Dr Reddys',
  'Hetero',
  'Amneal Pharmaceuticals',
  'Eisai Pharmaceuticals India',
  'Granules India',
  'Pulsus Healthtech',
  'Pulsus Group',
  'Bioksha',
  'Tablets India',
  'Benovymed Healthcare',
  'Benovymed Healthcare Private Ltd',
  'MGM Healthcare',
  'Transasia Bio-Medicals Ltd.',
  'Aspiro Pharma',
  'Deccan Fine Chemicals',
  'Biocon',
  'Apollo Hospitals',
  'Care Hospitals',
  'Medicover Hospitals',
  'Fresenius Medical Care'
);

-- Education & Universities
update public.companies
set is_directory_approved = true, category = 'Education'
where name in (
  'GITAM Deemed University',
  'Nxtwave Disruptive Technologies',
  'PlanetSpark',
  'Teks Academy',
  'SIMS College',
  'Mdn Edify Education',
  'Kiya World School',
  'DA VINCI INTERNATIONAL SCHOOL',
  'With Ease Education India',
  'Escape Academy'
);

-- Banking & Financial Services
update public.companies
set is_directory_approved = true, category = 'Banking & Finance'
where name in (
  'Bajaj Finance',
  'Bajaj Finserv',
  'Axis Max Life Insurance',
  'Kotak Mahindra Bank',
  'DBS Bank',
  'Tata Capital',
  'Credit Saison India',
  'IDFC FIRST Bank',
  'AU SMALL FINANCE BANK',
  'Muthoot Finance',
  'Ujjivan Small Finance Bank',
  'CSB Bank',
  'Indusind Bank',
  'Karur Vysya Bank',
  'Grihum Housing Finance',
  'Star Union Dai ichi Life Insurance (SUD Life)',
  'Phonepe',
  'Policybazaar',
  'Policybazaar.com'
);

-- Manufacturing & Engineering
update public.companies
set is_directory_approved = true, category = 'Manufacturing'
where name in (
  'Asian Paints',
  'Indus Towers',
  'GMR Group',
  'Adani Group',
  'JLL',
  'Stantec',
  'KONE',
  'PBL Transport Corporation Private Limited',
  'PBL Transport Corporation',
  'URC Construction (P) Ltd',
  'Foxconn',
  'JSE Engineering Pvt. Ltd.',
  'JSE Engineering',
  'brandix'
);

-- Hospitality & Retail
update public.companies
set is_directory_approved = true, category = 'Hospitality & Retail'
where name in (
  'Accor',
  'Marriott',
  'Pema Wellness Retreat',
  'Livspace',
  'HomeLane',
  'Lenskart',
  'H&M',
  'cult fit',
  'Sodexo',
  'Decorpot',
  'SITARAM MOTORS',
  'Swiggy',
  'Armani Exchange'
);
