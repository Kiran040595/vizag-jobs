-- Add industry and location columns to employer_profiles
-- Update handle_new_employer_user() trigger function to populate contact details from signup metadata

alter table public.employer_profiles
  add column if not exists industry text,
  add column if not exists location text;

comment on column public.employer_profiles.industry is
  'Business sector / industry of the hiring company (e.g. IT & Software, Manufacturing, Pharma, etc.)';

comment on column public.employer_profiles.location is
  'Office area / location in Visakhapatnam (e.g. Rushikonda IT SEZ, Gajuwaka, Dwaraka Nagar, etc.)';

-- Update the auth trigger function to capture contact details from signup metadata
create or replace function public.handle_new_employer_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_company text;
  signup_contact_name text;
  signup_phone text;
  signup_industry text;
  signup_location text;
begin
  signup_company := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
  signup_contact_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'contact_name', '')), '');
  signup_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  signup_industry := nullif(trim(coalesce(new.raw_user_meta_data ->> 'industry', '')), '');
  signup_location := nullif(trim(coalesce(new.raw_user_meta_data ->> 'location', '')), '');

  insert into public.employer_profiles (
    user_id,
    company_name,
    contact_name,
    contact_email,
    phone,
    industry,
    location
  )
  values (
    new.id,
    coalesce(signup_company, 'Your company'),
    signup_contact_name,
    new.email,
    signup_phone,
    signup_industry,
    signup_location
  )
  on conflict (user_id) do update set
    company_name = coalesce(nullif(excluded.company_name, 'Your company'), public.employer_profiles.company_name),
    contact_name = coalesce(excluded.contact_name, public.employer_profiles.contact_name),
    phone = coalesce(excluded.phone, public.employer_profiles.phone),
    industry = coalesce(excluded.industry, public.employer_profiles.industry),
    location = coalesce(excluded.location, public.employer_profiles.location);

  return new;
end;
$$;
