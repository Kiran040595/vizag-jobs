-- Students sign in immediately after register — no email confirmation step.
-- Covers production even if Auth "Confirm email" is left enabled in the dashboard.

create or replace function public.auto_confirm_student_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_type text;
begin
  user_type := lower(trim(coalesce(new.raw_user_meta_data ->> 'user_type', '')));

  if user_type = 'student' then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, timezone('utc', now()));
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_auto_confirm_student on auth.users;
create trigger on_auth_user_auto_confirm_student
before insert on auth.users
for each row
execute function public.auto_confirm_student_auth_user();

-- Confirm any existing unconfirmed student accounts.
update auth.users u
set email_confirmed_at = coalesce(u.email_confirmed_at, timezone('utc', now()))
where u.email_confirmed_at is null
  and lower(trim(coalesce(u.raw_user_meta_data ->> 'user_type', ''))) = 'student';
