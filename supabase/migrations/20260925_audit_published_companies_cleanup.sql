-- Migration: Audit & Clean Published Companies in Visakhapatnam Directory
-- 1. Unpublish non-Vizag, remote-only, dead-domain, or duplicate companies:
--    - BairesDev (US/LatAm remote only)
--    - Turing (US remote freelance marketplace)
--    - Google (No corporate facility in Vizag)
--    - Uber (No corporate facility in Vizag)
--    - Armani Exchange (Retail mall brand with expired SSL)
--    - Escape Academy (Non-existent synthesized domain)
--    - With Ease Education India (Non-existent synthesized domain)
--    - DA VINCI INTERNATIONAL SCHOOL (No school in Vizag)
--    - Tablets India (Chennai pharma with no Vizag facility)
--    - Fresenius Medical Care (No dedicated center in Vizag)
--    - PlanetSpark (Gurgaon edtech WFH only)
--    - Patra Corporation (Duplicate of Patra India)

UPDATE public.companies
SET is_directory_approved = false,
    updated_at = NOW()
WHERE name IN (
  'BairesDev',
  'Turing',
  'Google',
  'Uber',
  'Armani Exchange',
  'Escape Academy',
  'With Ease Education India',
  'DA VINCI INTERNATIONAL SCHOOL',
  'Tablets India',
  'Fresenius Medical Care',
  'PlanetSpark',
  'Patra Corporation'
);

-- 2. Update verified URLs for published Vizag companies:

-- PBL Transport Corporation (Headquartered in Visakhapatnam)
UPDATE public.companies
SET website = 'https://www.pbltransport.co.in/',
    careers_url = 'https://www.pbltransport.co.in/',
    updated_at = NOW()
WHERE name = 'PBL Transport Corporation';

-- Karur Vysya Bank
UPDATE public.companies
SET website = 'https://www.kvb.co.in',
    careers_url = 'https://careers.karurvysya.bank.in',
    updated_at = NOW()
WHERE name = 'Karur Vysya Bank';

-- Hetero
UPDATE public.companies
SET website = 'https://www.hetero.com',
    careers_url = 'https://www.heterohealthcare.com/careers',
    updated_at = NOW()
WHERE name = 'Hetero';

-- Foxconn
UPDATE public.companies
SET website = 'https://www.foxconn.com',
    careers_url = 'https://recruit.foxconn.com',
    updated_at = NOW()
WHERE name = 'Foxconn';

-- JLL
UPDATE public.companies
SET website = 'https://www.jll.co.in',
    careers_url = 'https://www.jll.co.in/en/careers',
    updated_at = NOW()
WHERE name = 'JLL';

-- JSE Engineering (Visakhapatnam Birla Junction)
UPDATE public.companies
SET website = 'https://www.jseengineering.com',
    careers_url = 'https://jseacademy.com/contact-us/',
    updated_at = NOW()
WHERE name = 'JSE Engineering';

-- Transasia Bio-Medicals Ltd.
UPDATE public.companies
SET website = 'https://transasia.co.in',
    careers_url = 'https://erbamannheim.com/careers',
    updated_at = NOW()
WHERE name = 'Transasia Bio-Medicals Ltd.';

-- Decorpot (Waltair Uplands, Visakhapatnam)
UPDATE public.companies
SET website = 'https://www.decorpot.com',
    careers_url = 'https://www.decorpot.com/contact-us',
    updated_at = NOW()
WHERE name = 'Decorpot';

-- Benovymed Healthcare (Visakhapatnam)
UPDATE public.companies
SET website = 'https://benovymed.com',
    careers_url = 'https://benovymed.com/contact-us',
    updated_at = NOW()
WHERE name = 'Benovymed Healthcare';

-- Teks Academy (Dwarakanagar, Visakhapatnam)
UPDATE public.companies
SET website = 'https://teksacademy.com',
    careers_url = 'https://teksacademy.com/contact-us/',
    updated_at = NOW()
WHERE name = 'Teks Academy';

-- Kiya World School (Gambhiram, Visakhapatnam)
UPDATE public.companies
SET website = 'https://kiyaworldschool.com',
    careers_url = 'https://kiyaworldschool.com',
    updated_at = NOW()
WHERE name = 'Kiya World School';

-- Eisai Pharmaceuticals India (Parawada SEZ, Visakhapatnam)
UPDATE public.companies
SET website = 'https://www.eisai.co.in',
    careers_url = 'https://www.eisai.co.in/contactus.html',
    updated_at = NOW()
WHERE name = 'Eisai Pharmaceuticals India';

-- Edify Education (Simhachalam & Sheela Nagar, Visakhapatnam)
UPDATE public.companies
SET name = 'Edify Education',
    website = 'https://edifyschools.com',
    careers_url = 'https://edifyschools.com/careers/',
    updated_at = NOW()
WHERE name = 'Mdn Edify Education';

-- Ensure Patra India has canonical details
UPDATE public.companies
SET website = 'https://patracorp.com',
    careers_url = 'https://patracorp.com/careers/',
    is_directory_approved = true,
    updated_at = NOW()
WHERE name = 'Patra India';
