-- Apply registration consents from signup metadata when no auth session exists yet.

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_type text;
  signup_company text;
  signup_name text;
  signup_college text;
  signup_phone text;
  signup_consents boolean;
  consent_time timestamptz;
begin
  user_type := lower(trim(coalesce(new.raw_user_meta_data ->> 'user_type', 'employer')));
  signup_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  signup_college := nullif(trim(coalesce(new.raw_user_meta_data ->> 'college', '')), '');
  signup_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')), '');
  signup_consents := lower(coalesce(new.raw_user_meta_data ->> 'registration_consents', '')) in ('true', '1', 'yes');
  consent_time := case when signup_consents then timezone('utc', now()) else null end;

  if user_type = 'student' then
    insert into public.student_profiles (
      user_id,
      full_name,
      college,
      contact_email,
      phone,
      consent_terms_at,
      consent_share_with_employers_at,
      consent_accurate_info_at,
      consent_age_18_at
    )
    values (
      new.id,
      coalesce(signup_name, 'Your name'),
      signup_college,
      nullif(trim(coalesce(new.email, '')), ''),
      signup_phone,
      consent_time,
      consent_time,
      consent_time,
      consent_time
    )
    on conflict (user_id) do nothing;
  else
    signup_company := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
    insert into public.employer_profiles (user_id, company_name, contact_email)
    values (
      new.id,
      coalesce(signup_company, 'Your company'),
      new.email
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;
