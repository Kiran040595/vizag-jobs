-- Punctual Naukri trigger: 4:30 PM IST = 11:00 UTC.
-- Run once in the Supabase SQL editor after vault secrets exist.
--
-- Required vault secrets:
--   project_url              = https://<project-ref>.supabase.co
--   fetch_jobs_cron_secret   = same value as FETCH_JOBS_CRON_SECRET
--
-- Example (run separately; do not commit real values):
--   select vault.create_secret('https://YOUR_PROJECT.supabase.co', 'project_url');
--   select vault.create_secret('YOUR_FETCH_JOBS_CRON_SECRET', 'fetch_jobs_cron_secret');

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;

create or replace function private.invoke_dispatch_naukri()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'fetch_jobs_cron_secret'
  limit 1;

  if project_url is null or cron_secret is null then
    raise exception 'Missing vault secrets project_url or fetch_jobs_cron_secret';
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/dispatch-naukri-workflow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret,
      'x-fetch-jobs-cron-secret', cron_secret
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_dispatch_naukri() from public;
revoke all on function private.invoke_dispatch_naukri() from anon;
revoke all on function private.invoke_dispatch_naukri() from authenticated;

do $$
begin
  perform cron.unschedule('dispatch-naukri-1630-ist');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'dispatch-naukri-1630-ist',
  '0 11 * * *',
  $$select private.invoke_dispatch_naukri();$$
);
