-- Clean noisy SEO titles previously copied into jobs.role.

create or replace function public.clean_job_role_label(raw text)
returns text
language plpgsql
immutable
as $$
declare
  text_value text := trim(coalesce(raw, ''));
  first_pipe text;
begin
  if text_value = '' then
    return null;
  end if;

  -- Keep text before the first pipe when later segments are CTA/experience junk.
  if position('|' in text_value) > 0 then
    first_pipe := trim(split_part(text_value, '|', 1));
    if first_pipe <> '' then
      text_value := first_pipe;
    end if;
  end if;

  text_value := regexp_replace(
    text_value,
    '\s*[|–—-]\s*(fresher|experienced|experience|apply[[:space:]]*now|walk[[:space:]-]?in|immediate[[:space:]]*joiner|hot[[:space:]]*job).*$',
    '',
    'i'
  );
  text_value := regexp_replace(
    text_value,
    '\s+jobs?[[:space:]]+in[[:space:]]+(vizag|visakhapatnam|vishakhapatnam|andhra[[:space:]]*pradesh|ap)([[:space:]].*)?$',
    '',
    'i'
  );
  text_value := regexp_replace(
    text_value,
    '\s+at[[:space:]]+[A-Za-z0-9][\w&. ''-]{1,80}$',
    '',
    'i'
  );
  text_value := regexp_replace(
    text_value,
    '\s*\((vizag|visakhapatnam|vishakhapatnam|remote|hybrid)\)\s*$',
    '',
    'i'
  );
  text_value := regexp_replace(
    text_value,
    '^(vizag|visakhapatnam|vishakhapatnam)[[:space:]]+',
    '',
    'i'
  );
  text_value := regexp_replace(text_value, '[[:space:]]+jobs?[[:space:]]*$', '', 'i');
  text_value := regexp_replace(text_value, '\s*[|–—-]\s*$', '', 'g');
  text_value := regexp_replace(text_value, '\.{2,}$', '', 'g');
  text_value := trim(regexp_replace(text_value, '\s+', ' ', 'g'));

  if char_length(text_value) > 56 then
    text_value := trim(substring(text_value from 1 for 56));
    text_value := regexp_replace(text_value, '\s+\S*$', '');
  end if;

  if text_value ~* '^(job|jobs|opening|openings|hiring|vacancy|vacancies)$' then
    return null;
  end if;

  if text_value = '' then
    return null;
  end if;

  return text_value;
end;
$$;

update public.jobs
set role = coalesce(
  public.clean_job_role_label(role),
  public.clean_job_role_label(title),
  nullif(trim(title), '')
)
where role is not null
   or title is not null;
