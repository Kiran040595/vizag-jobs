-- Official Workday CXS rechecked 2026-11-01: seven explicit Visakhapatnam
-- vacancies. Other-city rows are rejected by the publication location gate.
UPDATE public.companies SET is_directory_approved = true
WHERE name IN ('Pfizer', 'Pfizer Healthcare India Private Limited - Vizag')
AND careers_url LIKE 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers?locations=e2d3979e3af10195da701f58076c648f%';
