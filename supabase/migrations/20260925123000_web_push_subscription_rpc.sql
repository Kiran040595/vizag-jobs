-- Let signed-in students and signed-out visitors register a browser/PWA push
-- subscription without exposing other people's endpoints.

create or replace function public.register_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_expiration timestamptz default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  endpoint_text text := nullif(btrim(coalesce(p_endpoint, '')), '');
  p256dh_text text := nullif(btrim(coalesce(p_p256dh, '')), '');
  auth_text text := nullif(btrim(coalesce(p_auth, '')), '');
begin
  if endpoint_text is null or p256dh_text is null or auth_text is null then
    raise exception 'Push subscription is incomplete.';
  end if;

  if caller is null then
    insert into public.web_push_subscriptions (
      user_id, endpoint, p256dh, auth, expiration_time, user_agent
    )
    values (
      null,
      endpoint_text,
      p256dh_text,
      auth_text,
      p_expiration,
      left(coalesce(p_user_agent, ''), 240)
    )
    on conflict (endpoint) do update
      set
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        expiration_time = excluded.expiration_time,
        user_agent = excluded.user_agent,
        updated_at = timezone('utc', now())
      where public.web_push_subscriptions.user_id is null;
    return;
  end if;

  insert into public.web_push_subscriptions (
    user_id, endpoint, p256dh, auth, expiration_time, user_agent
  )
  values (
    caller,
    endpoint_text,
    p256dh_text,
    auth_text,
    p_expiration,
    left(coalesce(p_user_agent, ''), 240)
  )
  on conflict (endpoint) do update
    set
      user_id = caller,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      expiration_time = excluded.expiration_time,
      user_agent = excluded.user_agent,
      updated_at = timezone('utc', now())
    where public.web_push_subscriptions.user_id is null
      or public.web_push_subscriptions.user_id = caller;
end;
$$;

create or replace function public.unregister_web_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  endpoint_text text := nullif(btrim(coalesce(p_endpoint, '')), '');
begin
  if endpoint_text is null then
    return;
  end if;

  delete from public.web_push_subscriptions
  where endpoint = endpoint_text
    and (
      user_id is null
      or user_id = caller
    );
end;
$$;

revoke all on function public.register_web_push_subscription(text, text, text, timestamptz, text) from public;
revoke all on function public.unregister_web_push_subscription(text) from public;
grant execute on function public.register_web_push_subscription(text, text, text, timestamptz, text) to anon, authenticated;
grant execute on function public.unregister_web_push_subscription(text) to anon, authenticated;
