-- Admin credentials management and account status inspection
-- Allows authorized admin users to view auth status, change email, and reset passwords for employer and student accounts.

create or replace function public.admin_update_user_credentials(
  p_target_user_id uuid,
  p_new_email text default null,
  p_new_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_admin_uid uuid := auth.uid();
  v_clean_email text;
  v_clean_pass text;
  v_current_email text;
  v_email_updated boolean := false;
  v_password_updated boolean := false;
  v_result jsonb;
begin
  -- 1. Check caller is an admin
  if not public.is_admin(v_admin_uid) then
    raise exception 'Unauthorized: Admin privileges required to update user credentials.';
  end if;

  -- 2. Verify target user exists
  select email into v_current_email
  from auth.users
  where id = p_target_user_id;

  if v_current_email is null then
    raise exception 'User account not found for id %', p_target_user_id;
  end if;

  v_clean_email := nullif(trim(p_new_email), '');
  v_clean_pass := nullif(trim(p_new_password), '');

  if v_clean_email is null and v_clean_pass is null then
    raise exception 'Please provide a new email address or password to update.';
  end if;

  -- 3. Handle email change
  if v_clean_email is not null then
    v_clean_email := lower(v_clean_email);

    if v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
      raise exception 'Invalid email address format: %', v_clean_email;
    end if;

    -- Check if another user already has this email
    if exists (
      select 1 from auth.users
      where lower(email) = v_clean_email
        and id <> p_target_user_id
    ) then
      raise exception 'The email address % is already registered to another account.', v_clean_email;
    end if;

    -- Update auth.users
    update auth.users
    set
      email = v_clean_email,
      email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
      raw_user_meta_data = jsonb_set(
        coalesce(raw_user_meta_data, '{}'::jsonb),
        '{email}',
        to_jsonb(v_clean_email),
        true
      ),
      updated_at = timezone('utc', now())
    where id = p_target_user_id;

    -- Update auth.identities
    update auth.identities
    set
      email = v_clean_email,
      identity_data = jsonb_set(
        jsonb_set(
          coalesce(identity_data, '{}'::jsonb),
          '{email}',
          to_jsonb(v_clean_email),
          true
        ),
        '{email_verified}',
        'true'::jsonb,
        true
      ),
      updated_at = timezone('utc', now())
    where user_id = p_target_user_id
      and provider = 'email';

    -- Synchronize profile tables
    update public.employer_profiles
    set
      contact_email = v_clean_email,
      updated_at = timezone('utc', now())
    where user_id = p_target_user_id;

    update public.student_profiles
    set
      contact_email = v_clean_email,
      updated_at = timezone('utc', now())
    where user_id = p_target_user_id;

    v_current_email := v_clean_email;
    v_email_updated := true;
  end if;

  -- 4. Handle password change
  if v_clean_pass is not null then
    if length(v_clean_pass) < 6 then
      raise exception 'New password must be at least 6 characters.';
    end if;

    update auth.users
    set
      encrypted_password = extensions.crypt(v_clean_pass, extensions.gen_salt('bf')),
      updated_at = timezone('utc', now())
    where id = p_target_user_id;

    v_password_updated := true;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'email', v_current_email,
    'email_updated', v_email_updated,
    'password_updated', v_password_updated,
    'updated_at', timezone('utc', now())
  );

  return v_result;
end;
$$;

create or replace function public.admin_get_user_account_status(
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_admin_uid uuid := auth.uid();
  v_user record;
  v_employer record;
  v_student record;
  v_account_type text := 'unknown';
  v_is_active boolean := true;
  v_display_name text := '';
  v_result jsonb;
begin
  -- 1. Check caller is an admin
  if not public.is_admin(v_admin_uid) then
    raise exception 'Unauthorized: Admin privileges required to inspect user status.';
  end if;

  -- 2. Query auth user
  select
    id,
    email,
    email_confirmed_at,
    last_sign_in_at,
    created_at,
    updated_at,
    phone,
    banned_until,
    (encrypted_password is not null and encrypted_password <> '') as has_password
  into v_user
  from auth.users
  where id = p_target_user_id;

  if v_user.id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'User not found in authentication system',
      'user_id', p_target_user_id
    );
  end if;

  -- 3. Determine role & profile info
  if exists (select 1 from public.admin_users where user_id = p_target_user_id) then
    v_account_type := 'admin';
  end if;

  select company_name, is_active, phone into v_employer
  from public.employer_profiles
  where user_id = p_target_user_id;

  if v_employer.company_name is not null then
    if v_account_type = 'unknown' then
      v_account_type := 'employer';
    end if;
    v_is_active := coalesce(v_employer.is_active, true);
    v_display_name := v_employer.company_name;
  end if;

  select full_name, is_active, phone into v_student
  from public.student_profiles
  where user_id = p_target_user_id;

  if v_student.full_name is not null then
    if v_account_type = 'unknown' then
      v_account_type := 'student';
    end if;
    v_is_active := coalesce(v_student.is_active, true);
    v_display_name := v_student.full_name;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'user_id', v_user.id,
    'email', v_user.email,
    'email_confirmed', v_user.email_confirmed_at is not null,
    'email_confirmed_at', v_user.email_confirmed_at,
    'last_sign_in_at', v_user.last_sign_in_at,
    'created_at', v_user.created_at,
    'updated_at', v_user.updated_at,
    'phone', coalesce(v_user.phone, v_student.phone, v_employer.phone, ''),
    'banned_until', v_user.banned_until,
    'has_password', v_user.has_password,
    'account_type', v_account_type,
    'is_active', v_is_active,
    'display_name', v_display_name
  );

  return v_result;
end;
$$;

create or replace function public.admin_get_users_account_status(
  p_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_admin_uid uuid := auth.uid();
  v_result jsonb;
begin
  if not public.is_admin(v_admin_uid) then
    raise exception 'Unauthorized: Admin privileges required to inspect user status.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', u.id,
      'email', u.email,
      'email_confirmed', u.email_confirmed_at is not null,
      'email_confirmed_at', u.email_confirmed_at,
      'last_sign_in_at', u.last_sign_in_at,
      'created_at', u.created_at,
      'updated_at', u.updated_at,
      'phone', coalesce(u.phone, sp.phone, ep.phone, ''),
      'banned_until', u.banned_until,
      'has_password', (u.encrypted_password is not null and u.encrypted_password <> ''),
      'account_type', case
        when au.user_id is not null then 'admin'
        when ep.user_id is not null then 'employer'
        when sp.user_id is not null then 'student'
        else 'other'
      end,
      'is_active', coalesce(ep.is_active, sp.is_active, true),
      'display_name', coalesce(ep.company_name, sp.full_name, '')
    )
  ), '[]'::jsonb)
  into v_result
  from auth.users u
  left join public.admin_users au on au.user_id = u.id
  left join public.employer_profiles ep on ep.user_id = u.id
  left join public.student_profiles sp on sp.user_id = u.id
  where u.id = any(p_user_ids);

  return v_result;
end;
$$;

revoke all on function public.admin_update_user_credentials(uuid, text, text) from public;
grant execute on function public.admin_update_user_credentials(uuid, text, text) to authenticated;

revoke all on function public.admin_get_user_account_status(uuid) from public;
grant execute on function public.admin_get_user_account_status(uuid) to authenticated;

revoke all on function public.admin_get_users_account_status(uuid[]) from public;
grant execute on function public.admin_get_users_account_status(uuid[]) to authenticated;
