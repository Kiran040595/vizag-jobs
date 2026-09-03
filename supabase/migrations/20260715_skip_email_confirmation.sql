-- One-time: allow existing student accounts to sign in without email confirmation.

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now()))
where email_confirmed_at is null;
