-- Resolve a student's auth email from their registered mobile number (login helper).

create index if not exists student_profiles_phone_idx on public.student_profiles (phone);

create or replace function public.resolve_student_login_email(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text;
  normalized text;
  found_email text;
begin
  digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if digits = '' then
    return null;
  end if;

  if length(digits) = 10 then
    normalized := '+91' || digits;
  elsif length(digits) = 12 and left(digits, 2) = '91' then
    normalized := '+' || digits;
  elsif length(digits) = 13 and left(digits, 3) = '091' then
    normalized := '+91' || right(digits, 10);
  else
    normalized := '+' || digits;
  end if;

  select sp.contact_email
  into found_email
  from public.student_profiles sp
  where sp.is_active is not distinct from true
    and sp.contact_email is not null
    and regexp_replace(coalesce(sp.phone, ''), '\D', '', 'g') = regexp_replace(normalized, '\D', '', 'g')
  order by sp.created_at desc
  limit 1;

  return found_email;
end;
$$;

revoke all on function public.resolve_student_login_email(text) from public;
grant execute on function public.resolve_student_login_email(text) to anon, authenticated;
